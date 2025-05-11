import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mysql from "mysql2/promise";
import fs from "fs";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

// Initialisation d'Express
const app = express();
const PORT = 3000;

// Récupérer le répertoire actuel
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration codée en dur (À REMPLACER PAR DES VALEURS SÉCURISÉES)
const JWT_SECRET = "mysecretkey123"; // Remplacez par une chaîne sécurisée
const GEMINI_API_KEY = "AIzaSyCeF1yuD4iHhkOvgiEUri8D0HCrNCglHRg"; // Remplacez par votre clé Google Gemini

// Initialisation de Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Vérifier l'existence des fichiers HTML
const requiredFiles = ["student.html", "teacher_interface.html", "signup.html", "login.html", "interface_exam.html"];
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Erreur : Fichier ${file} introuvable à ${filePath}`);
    process.exit(1);
  }
}
console.log(`Fichiers HTML trouvés dans : ${__dirname}`);

// Initialisation de MySQL
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "examen_en_ligne",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Tester la connexion MySQL au démarrage
async function testMySQLConnection() {
  try {
    const [result] = await pool.query("SELECT 1 AS test");
    console.log("Connexion MySQL réussie :", result);
  } catch (err) {
    console.error("Erreur de connexion MySQL :", err.message);
    process.exit(1);
  }
}
testMySQLConnection();

// Configuration de Nodemailer (À CONFIGURER)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "votre_email@gmail.com", // Remplacez par votre email Gmail
    pass: "votre_mot_de_passe_application", // Remplacez par votre mot de passe d'application Gmail
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Log des requêtes
app.use((req, res, next) => {
  console.log(`Requête reçue : ${req.method} ${req.url}`);
  next();
});

// Middleware d'authentification
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Accès non autorisé." });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: "Token invalide." });
  }
};

// Fonction pour envoyer une notification par email
async function sendNotificationEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: `"ExamOnline" <votre_email@gmail.com>`,
      to,
      subject,
      text,
    });
    console.log(`Email envoyé à ${to}`);
  } catch (err) {
    console.error(`Erreur lors de l'envoi de l'email à ${to} :`, err);
  }
}

// Fonction pour générer un mot de passe
function generatePassword(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// POST /api/users/location - Store user GPS coordinates
app.post("/api/users/location", authenticate, async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  if (!userId || latitude == null || longitude == null) {
    console.log("Données manquantes pour /api/users/location:", { userId, latitude, longitude });
    return res.status(400).json({ success: false, error: "userId, latitude, et longitude sont requis" });
  }

  if (req.user.id !== parseInt(userId)) {
    console.log(`Accès non autorisé: userId=${userId}, authenticated user=${req.user.id}`);
    return res.status(403).json({ success: false, error: "Accès non autorisé" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE utilisateurs SET latitude = ?, longitude = ? WHERE id = ?",
      [latitude, longitude, userId]
    );

    if (result.affectedRows === 0) {
      console.log(`Utilisateur non trouvé pour userId=${userId}`);
      return res.status(404).json({ success: false, error: "Utilisateur non trouvé" });
    }

    console.log(`Coordonnées GPS mises à jour pour userId=${userId}: lat=${latitude}, lon=${longitude}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur lors de la mise à jour des coordonnées GPS:", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET /api/users/locations - Retrieve student locations
app.get("/api/users/locations", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "professeur") {
      console.log(`Accès refusé: role=${req.user.role}, userId=${req.user.id}`);
      return res.status(403).json({ success: false, error: "Accès réservé aux professeurs" });
    }

    const [students] = await pool.query(
      "SELECT id, prenom, nom, email, latitude, longitude FROM utilisateurs WHERE role = ? AND latitude IS NOT NULL AND longitude IS NOT NULL",
      ["etudiant"]
    );

    console.log(`Localisations récupérées: ${students.length} étudiants trouvés`);
    res.json({ success: true, students });
  } catch (err) {
    console.error("Erreur lors de la récupération des localisations:", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET /api/exams/:id/settings - Retrieve exam settings
app.get("/api/exams/:id/settings", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const [exams] = await pool.query(
      `SELECT webcam, plein_ecran, anti_ia FROM examens WHERE id = ?`,
      [id]
    );
    if (!exams.length) {
      console.log(`Examen non trouvé pour id=${id}`);
      return res.status(404).json({ success: false, error: "Examen non trouvé" });
    }
    res.json({ success: true, settings: exams[0] });
  } catch (err) {
    console.error("Erreur lors de la récupération des paramètres d'examen :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// POST /api/cheating/report - Report cheating with screenshot
app.post("/api/cheating/report", authenticate, async (req, res) => {
  const { examen_id, capture_image } = req.body;
  const utilisateur_id = req.user.id;

  if (!examen_id || !capture_image) {
    console.log("Données manquantes pour /api/cheating/report:", { examen_id, capture_image });
    return res.status(400).json({ success: false, error: "examen_id et capture_image sont requis" });
  }

  try {
    const [examResult] = await pool.query(`SELECT id FROM examens WHERE id = ?`, [examen_id]);
    if (!examResult.length) {
      console.log(`Examen non trouvé pour id=${examen_id}`);
      return res.status(404).json({ success: false, error: "Examen non trouvé" });
    }

    await pool.query(
      `INSERT INTO triche (utilisateur_id, examen_id, capture_image, date_detection)
       VALUES (?, ?, ?, NOW())`,
      [utilisateur_id, examen_id, Buffer.from(capture_image, 'base64')]
    );

    console.log(`Triche signalée pour utilisateur_id=${utilisateur_id}, examen_id=${examen_id}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur lors du signalement de triche :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// GET /api/cheating/:examen_id - Retrieve cheating reports
app.get("/api/cheating/:examen_id", authenticate, async (req, res) => {
  const { examen_id } = req.params;
  if (req.user.role !== "professeur") {
    console.log(`Accès refusé pour userId=${req.user.id}, role=${req.user.role}`);
    return res.status(403).json({ success: false, error: "Accès réservé aux professeurs" });
  }

  try {
    const [reports] = await pool.query(
      `SELECT t.id, t.utilisateur_id, t.examen_id, t.capture_image, t.date_detection, u.nom, u.prenom
       FROM triche t
       JOIN utilisateurs u ON t.utilisateur_id = u.id
       WHERE t.examen_id = ?
       ORDER BY t.utilisateur_id, t.date_detection`,
      [examen_id]
    );

    const cheatingReports = reports.map(report => ({
      id: report.id,
      utilisateur_id: report.utilisateur_id,
      nom: report.nom,
      prenom: report.prenom,
      examen_id: report.examen_id,
      capture_image: report.capture_image.toString('base64'),
      date_detection: report.date_detection
    }));

    console.log(`Rapports de triche récupérés pour examen_id=${examen_id}: ${cheatingReports.length} trouvés`);
    res.json({ success: true, reports: cheatingReports });
  } catch (err) {
    console.error("Erreur lors de la récupération des rapports de triche :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Routes pour servir les pages HTML
app.get("/", (req, res) => {
  console.log("Requête GET / reçue");
  res.sendFile(path.join(__dirname, "student.html"));
});

app.get("/signup", (req, res) => {
  console.log("Requête GET /signup reçue");
  res.sendFile(path.join(__dirname, "signup.html"));
});

app.get("/login", (req, res) => {
  console.log("Requête GET /login reçue");
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/teacher", authenticate, (req, res) => {
  console.log("Requête GET /teacher reçue");
  res.sendFile(path.join(__dirname, "teacher_interface.html"));
});

app.get("/exam", (req, res) => {
  console.log("Requête GET /exam reçue");
  const filePath = path.join(__dirname, "interface_exam.html");
  console.log(`Tentative de servir : ${filePath}`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error(`Fichier non trouvé : ${filePath}`);
    res.status(404).send("Fichier interface_exam.html non trouvé");
  }
});

// Route pour l'inscription
app.post("/api/register", async (req, res) => {
  const { email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe } = req.body;
  console.log("Données d'inscription reçues :", { email, nom, prenom, date_naissance, sexe, etablissement, filiere, role });

  if (!email || !nom || !prenom || !date_naissance || !sexe || !etablissement || !filiere || !role || !mot_de_passe) {
    console.log("Données manquantes pour l'inscription");
    return res.status(400).json({ success: false, error: "Tous les champs obligatoires sont requis." });
  }

  if (!['masculin', 'feminin'].includes(sexe)) {
    console.log("Valeur sexe invalide :", sexe);
    return res.status(400).json({ success: false, error: "Sexe doit être 'masculin' ou 'feminin'." });
  }

  if (!['etudiant', 'professeur'].includes(role)) {
    console.log("Valeur rôle invalide :", role);
    return res.status(400).json({ success: false, error: "Rôle doit être 'etudiant' ou 'professeur'." });
  }

  try {
    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
    const [result] = await pool.query(
      `INSERT INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, hashedPassword]
    );
    console.log(`Utilisateur créé avec ID=${result.insertId}`);
    res.json({ success: true, message: "Utilisateur créé", id: result.insertId });
  } catch (err) {
    console.error("Erreur lors de l'inscription :", err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: "Cet email est déjà utilisé." });
    } else {
      res.status(500).json({ success: false, error: "Erreur serveur lors de l'inscription." });
    }
  }
});

// Route pour la connexion
app.post("/api/login", async (req, res) => {
  const { email, mot_de_passe } = req.body;
  console.log("Données de connexion reçues :", { email });

  if (!email || !mot_de_passe) {
    console.log("Données manquantes pour la connexion");
    return res.status(400).json({ success: false, error: "Email et mot de passe sont requis." });
  }

  try {
    const [users] = await pool.query(`SELECT id, role, mot_de_passe FROM utilisateurs WHERE email = ?`, [email]);
    if (users.length === 0) {
      console.log(`Utilisateur non trouvé pour email=${email}`);
      return res.status(401).json({ success: false, error: "Utilisateur non trouvé." });
    }
    const user = users[0];
    if (await bcrypt.compare(mot_de_passe, user.mot_de_passe)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
      console.log(`Connexion réussie pour utilisateur ID=${user.id}, role=${user.role}`);
      res.json({ success: true, token, userId: user.id, role: user.role });
    } else {
      console.log(`Mot de passe incorrect pour email=${email}`);
      res.status(401).json({ success: false, error: "Mot de passe incorrect." });
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur lors de la connexion." });
  }
});

// Route pour récupérer les matières
app.get("/api/matieres", authenticate, async (req, res) => {
  try {
    const [matieres] = await pool.query("SELECT id, nom FROM matieres");
    res.json(matieres);
  } catch (err) {
    console.error("Erreur lors de la récupération des matières :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur." });
  }
});

// Route pour créer un examen
app.post("/api/exams", authenticate, async (req, res) => {
  const { title, matiere_id, date_debut, duration, filiereCible, publicCible, webcam, fullscreen, noAI, questions, students } = req.body;
  const createur_id = req.user.id;
  console.log("Données de l'examen reçues :", { title, matiere_id, date_debut, duration, filiereCible, publicCible, webcam, fullscreen, noAI, questions, students });

  if (!title || !matiere_id || !date_debut || !duration || !questions.length || !students.length) {
    console.log("Données manquantes pour la création de l'examen");
    return res.status(400).json({ success: false, error: "Tous les champs obligatoires sont requis." });
  }

  try {
    const [matiere] = await pool.query(`SELECT id FROM matieres WHERE id = ?`, [matiere_id]);
    if (!matiere.length) {
      console.log(`Matière non trouvée pour matiere_id=${matiere_id}`);
      return res.status(400).json({ success: false, error: "Matière invalide." });
    }
  } catch (err) {
    console.error("Erreur lors de la validation de matiere_id :", err.message);
    return res.status(500).json({ success: false, error: "Erreur serveur lors de la validation de la matière." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const mot_de_passe = generatePassword();

    const [examResult] = await connection.query(
      `INSERT INTO examens (titre, matiere_id, createur_id, filiere_cible, date_debut, duree, statut, webcam, plein_ecran, anti_ia, mot_de_passe)
       VALUES (?, ?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?)`,
      [title, matiere_id, createur_id, filiereCible, date_debut, duration, webcam, fullscreen, noAI, mot_de_passe]
    );
    const examId = examResult.insertId;

    const [publicResult] = await connection.query(
      `INSERT INTO publics_cibles (nom, description) VALUES (?, ?)`,
      [publicCible, ""]
    );
    const publicCibleId = publicResult.insertId;

    await connection.query(
      `INSERT INTO examen_publics_cibles (examen_id, public_cible_id) VALUES (?, ?)`,
      [examId, publicCibleId]
    );

    for (const q of questions) {
      const [questionResult] = await connection.query(
        `INSERT INTO questions (examen_id, texte, type, points, reponse_attendue, temps_limite)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [examId, q.text, q.type.toUpperCase(), q.points, q.reponse_attendue || null, q.temps_limite || null]
      );
      const questionId = questionResult.insertId;

      if (q.type.toLowerCase() === "qcm") {
        for (let i = 0; i < q.options.length; i++) {
          await connection.query(
            `INSERT INTO choix (question_id, texte, correct) VALUES (?, ?, ?)`,
            [questionId, q.options[i], i === q.correctOption ? 1 : 0]
          );
        }
      }
    }

    for (const student of students) {
      const [userResult] = await connection.query(
        `INSERT INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nom = ?, prenom = ?, filiere = ?`,
        [
          student.email, student.nom, student.prenom, "2000-01-01", "masculin", "Université", student.filiere || null, "etudiant", "default_password",
          student.nom, student.prenom, student.filiere || null
        ]
      );
      const userId = userResult.insertId || (await connection.query(`SELECT id FROM utilisateurs WHERE email = ?`, [student.email]))[0][0].id;

      await connection.query(
        `INSERT INTO examen_etudiants (examen_id, utilisateur_id) VALUES (?, ?)`,
        [examId, userId]
      );

      const message = `Vous êtes invité à passer l'examen "${title}" le ${date_debut}. Mot de passe: ${mot_de_passe}`;
      await connection.query(
        `INSERT INTO notifications (utilisateur_id, examen_id, message, statut)
         VALUES (?, ?, ?, ?)`,
        [userId, examId, message, "envoye"]
      );

      await sendNotificationEmail(
        student.email,
        `Invitation à l'examen: ${title}`,
        `Bonjour ${student.prenom} ${student.nom},\n\nVous êtes invité à passer l'examen "${title}" le ${date_debut}.\nMot de passe: ${mot_de_passe}\n\nCordialement,\nL'équipe ExamOnline`
      );
    }

    await connection.commit();
    res.status(200).json({ success: true, examId, mot_de_passe });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erreur lors de la création de l'examen :", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Route pour régénérer le mot de passe d'un examen
app.post("/api/exams/:id/password", authenticate, async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const mot_de_passe = generatePassword();
    await connection.query(`UPDATE examens SET mot_de_passe = ? WHERE id = ?`, [mot_de_passe, id]);
    res.status(200).json({ success: true, mot_de_passe });
  } catch (err) {
    console.error("Erreur lors de la régénération du mot de passe :", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Route pour vérifier l'accès à un examen
app.post("/api/exams/:id/verify", authenticate, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const utilisateur_id = req.user.id;

  try {
    // Vérifier si l'étudiant a déjà passé l'examen
    const [resultats] = await pool.query(
      `SELECT id FROM resultats WHERE utilisateur_id = ? AND examen_id = ?`,
      [utilisateur_id, id]
    );
    if (resultats.length > 0) {
      console.log(`Examen déjà passé par utilisateur_id=${utilisateur_id}, examen_id=${id}`);
      return res.status(403).json({ success: false, error: "Vous avez déjà passé cet examen." });
    }

    const [result] = await pool.query(`SELECT mot_de_passe FROM examens WHERE id = ?`, [id]);
    if (!result.length || result[0].mot_de_passe !== password) {
      console.log(`Mot de passe incorrect ou examen non trouvé pour id=${id}`);
      return res.status(401).json({ success: false, error: "ID ou mot de passe incorrect" });
    }
    res.status(200).json({ success: true, message: "Accès autorisé" });
  } catch (err) {
    console.error("Erreur lors de la vérification de l'examen :", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route pour récupérer les détails d'un examen
app.get("/api/exams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [exams] = await pool.query(`SELECT titre, duree FROM examens WHERE id = ?`, [id]);
    if (!exams.length) {
      return res.status(404).json({ success: false, error: "Examen non trouvé" });
    }
    res.json({ success: true, ...exams[0] });
  } catch (err) {
    console.error("Erreur lors de la récupération de l'examen :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Route pour récupérer les questions d'un examen
app.get("/api/questions/:examen_id", async (req, res) => {
  const { examen_id } = req.params;
  console.log(`Requête reçue pour récupérer les questions de examen_id=${examen_id}`);

  const examId = parseInt(examen_id, 10);
  if (isNaN(examId) || examId <= 0) {
    console.error(`Erreur : examen_id=${examen_id} n'est pas un entier positif`);
    return res.status(400).json({ success: false, error: "ID d'examen invalide." });
  }

  try {
    console.log(`Vérification de l'existence de l'examen avec id=${examId}`);
    const [exams] = await pool.query(`SELECT id FROM examens WHERE id = ?`, [examId]);
    console.log(`Résultat de la vérification de l'examen :`, exams);
    if (!exams.length) {
      console.log(`Examen avec id=${examId} non trouvé`);
      return res.status(404).json({ success: false, error: "Examen non trouvé." });
    }

    console.log(`Récupération des questions pour examen_id=${examId}`);
    const [questions] = await pool.query(
      `SELECT id, texte, type, temps_limite, points, reponse_attendue FROM questions WHERE examen_id = ? ORDER BY id`,
      [examId]
    );
    console.log(`Questions récupérées pour examen_id=${examId} :`, questions);

    if (!questions.length) {
      console.log(`Aucune question trouvée pour examen_id=${examId}`);
      return res.status(400).json({ success: false, error: "Aucune question trouvée pour cet examen." });
    }

    res.json(questions);
  } catch (err) {
    console.error(`Erreur lors de la récupération des questions pour examen_id=${examen_id} :`, err);
    res.status(500).json({ success: false, error: `Erreur serveur : ${err.message}` });
  }
});

// Route pour récupérer les choix d'une question QCM
app.get("/api/choices/:question_id", async (req, res) => {
  const { question_id } = req.params;
  try {
    const [choices] = await pool.query(`SELECT id, texte FROM choix WHERE question_id = ?`, [question_id]);
    res.json(choices);
  } catch (err) {
    console.error("Erreur lors de la récupération des choix :", err.message);
    res.status(500).json({ success: false, error: "Erreur serveur" });
  }
});

// Route pour récupérer les notifications d'un utilisateur
app.get("/api/notifications/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    console.log(`Récupération des notifications pour userId=${userId}`);
    const [userResult] = await pool.query(`SELECT filiere FROM utilisateurs WHERE id = ?`, [userId]);
    if (!userResult.length) {
      console.log(`Utilisateur non trouvé : userId=${userId}`);
      return res.status(404).json({ success: false, error: "Utilisateur non trouvé" });
    }
    const userFiliere = userResult[0].filiere || null;
    console.log(`Filière de l'utilisateur : ${userFiliere}`);

    const [notifications] = await pool.query(
      `SELECT n.message, e.id as examen_id, e.titre, e.date_debut, e.mot_de_passe
       FROM notifications n
       JOIN examens e ON n.examen_id = e.id
       WHERE n.utilisateur_id = ? AND (e.filiere_cible = ? OR e.filiere_cible IS NULL)`,
      [userId, userFiliere]
    );
    console.log(`Notifications récupérées :`, notifications);

    res.status(200).json({ success: true, notifications });
  } catch (err) {
    console.error("Erreur lors de la récupération des notifications :", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route pour vérifier et enregistrer une réponse
app.post("/verifier", async (req, res) => {
  const { question_id, etudiant, choix_id, note, examen_id, utilisateur_id, question_index } = req.body;
  console.log("Données du formulaire :", { question_id, etudiant, choix_id, note, examen_id, utilisateur_id, question_index });

  if (!question_id || !examen_id || !utilisateur_id || question_index === undefined) {
    console.log("Données manquantes dans le formulaire");
    return res.status(400).json({ success: false, error: "Toutes les données du formulaire sont requises." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM soumissions WHERE utilisateur_id = ? AND question_id = ?`,
      [utilisateur_id, question_id]
    );
    console.log(`Anciennes soumissions supprimées pour utilisateur_id=${utilisateur_id}, question_id=${question_id}`);

    const [questions] = await connection.query(
      `SELECT texte, type, reponse_attendue, points FROM questions WHERE id = ?`,
      [question_id]
    );
    if (!questions.length) {
      console.error(`Question introuvable pour question_id=${question_id}`);
      return res.status(404).json({ success: false, error: "Question introuvable." });
    }
    const { texte, type, reponse_attendue, points } = questions[0];

    let score = 0;
    if (type === "QCM") {
      if (!choix_id) {
        return res.status(400).json({ success: false, error: "Choix requis pour une question QCM." });
      }
      const [choices] = await connection.query(
        `SELECT correct FROM choix WHERE id = ?`,
        [choix_id]
      );
      if (!choices.length) {
        return res.status(404).json({ success: false, error: "Choix introuvable." });
      }
      score = choices[0].correct ? parseFloat(points) : 0;
    } else if (type === "OUVERTE") {
      if (!etudiant) {
        return res.status(400).json({ success: false, error: "Réponse requise pour une question ouverte." });
      }
      if (!reponse_attendue) {
        console.error(`Réponse attendue non définie pour question_id=${question_id}`);
        return res.status(500).json({ success: false, error: "Réponse attendue non définie." });
      }
      const prompt = `
        Tu es un correcteur d'examen bienveillant.
        Voici une question : "${texte}"
        Réponse attendue : "${reponse_attendue}"
        Réponse de l'étudiant : "${etudiant}"
        Points de la question : "${points}"
        Évalue la réponse de l'étudiant en attribuant un pourcentage de correction (0 à 100 %).
        Si le pourcentage est supérieur à 89 %, attribue 100 %.
        Retourne uniquement le pourcentage (ex. "95").
      `;
      console.log("Prompt envoyé à Gemini :", prompt);
      const result = await model.generateContent(prompt);
      const percentage = parseFloat(await result.response.text());
      console.log(`Réponse de Gemini : ${percentage}%`);
      score = (percentage / 100) * parseFloat(points);
      console.log(`Score calculé : ${score}/${points} (pourcentage : ${percentage}%)`);
    }

    await connection.query(
      `INSERT INTO soumissions (utilisateur_id, question_id, reponse_texte, choix_id, score, date_soumission)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [utilisateur_id, question_id, etudiant || null, choix_id || null, score]
    );
    console.log(`Soumission enregistrée : utilisateur_id=${utilisateur_id}, question_id=${question_id}, score=${score}`);

    const questionIndex = parseInt(question_index, 10);
    const [allQuestions] = await connection.query(
      `SELECT id FROM questions WHERE examen_id = ? ORDER BY id`,
      [examen_id]
    );
    const isLastQuestion = questionIndex >= allQuestions.length - 1;

    const [soumissions] = await connection.query(
      `SELECT score FROM soumissions WHERE utilisateur_id = ? AND question_id IN (
        SELECT id FROM questions WHERE examen_id = ?
      ) ORDER BY date_soumission DESC LIMIT ?`,
      [utilisateur_id, examen_id, allQuestions.length]
    );
    const total_score = soumissions.reduce((sum, s) => sum + parseFloat(s.score), 0) || 0;
    console.log(`Soumissions pour note totale :`, soumissions);
    console.log(`Note totale calculée : ${total_score}/${allQuestions.length * 5}`);

    await connection.query(
      `INSERT INTO resultats (utilisateur_id, examen_id, score, date_completion)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE score = ?, date_completion = NOW()`,
      [utilisateur_id, examen_id, total_score, total_score]
    );

    await connection.commit();

    if (isLastQuestion) {
      res.json({
        success: true,
        score: parseFloat(score.toFixed(2)),
        total_score: parseFloat(total_score.toFixed(2)),
        max_score: allQuestions.length * 5,
        message: "Examen terminé !",
        isLastQuestion: true
      });
    } else {
      res.json({
        success: true,
        score: parseFloat(score.toFixed(2)),
        total_score: parseFloat(total_score.toFixed(2)),
        max_score: allQuestions.length * 5,
        message: "Réponse enregistrée.",
        next_question_index: questionIndex + 1,
        isLastQuestion: false
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erreur lors du traitement :", err.message);
    res.status(500).json({ success: false, error: `Erreur : ${err.message}` });
  } finally {
    if (connection) connection.release();
  }
});

// Gestion des erreurs pour les routes non trouvées
app.use((req, res) => {
  console.log(`Route non trouvée : ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: "The requested resource was not found on this server." });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

// Fermer la connexion MySQL à l'arrêt
process.on("SIGINT", async () => {
  await pool.end();
  console.log("Connexion MySQL fermée.");
  process.exit(0);
});