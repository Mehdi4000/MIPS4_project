import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mysql from "mysql2/promise";
import fs from "fs";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Charger les variables d'environnement
dotenv.config();

// Vérifier les variables d'environnement
if (!process.env.GEMINI_API_KEY) {
  console.error("Erreur : GEMINI_API_KEY non définie dans .env");
  process.exit(1);
}
if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
  console.error("Erreur : Variables MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE) non définies dans .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("Erreur : JWT_SECRET non défini dans .env");
  process.exit(1);
}

// Initialisation d'Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Récupérer le répertoire actuel
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vérifier l'existence du dossier public et des fichiers HTML
const publicPath = path.join(__dirname, "public");
const reponsePath = path.join(publicPath, "reponse.html");
const teacherInterfacePath = path.join(publicPath, "teacher_interface.html");
if (!fs.existsSync(publicPath)) {
  console.error(`Erreur : Dossier public introuvable à ${publicPath}`);
  process.exit(1);
}
if (!fs.existsSync(reponsePath)) {
  console.error(`Erreur : Fichier reponse.html introuvable à ${reponsePath}`);
  process.exit(1);
}
if (!fs.existsSync(teacherInterfacePath)) {
  console.error(`Erreur : Fichier teacher_interface.html introuvable à ${teacherInterfacePath}`);
  process.exit(1);
}
console.log(`Dossier public trouvé : ${publicPath}`);
console.log(`Fichier reponse.html trouvé : ${reponsePath}`);
console.log(`Fichier teacher_interface.html trouvé : ${teacherInterfacePath}`);

// Initialisation de MySQL
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

// Log toutes les requêtes
app.use((req, res, next) => {
  console.log(`Requête reçue : ${req.method} ${req.url}`);
  next();
});

// Middleware d'authentification
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).send("Accès non autorisé.");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Token invalide.");
  }
};

// Route pour afficher le formulaire étudiant
app.get("/", (req, res) => {
  console.log("Requête GET / reçue");
  res.sendFile(reponsePath);
});

// Route pour afficher l'interface enseignant
app.get("/teacher", authenticate, (req, res) => {
  console.log("Requête GET /teacher reçue");
  res.sendFile(teacherInterfacePath);
});

// Route pour récupérer les questions d'un examen
app.get("/api/questions/:examen_id", async (req, res) => {
  const { examen_id } = req.params;
  try {
    const [questions] = await pool.query(
      `SELECT id, texte, time_limit, points, reponse_attendue FROM questions WHERE examen_id = ? AND type = 'OUVERTE' ORDER BY id LIMIT 2`,
      [examen_id]
    );
    console.log(`Questions récupérées pour examen_id=${examen_id} :`, questions);
    if (questions.length < 2) {
      console.error(`Erreur : Moins de 2 questions trouvées pour examen_id=${examen_id}`);
      return res.status(400).json({ error: "Pas assez de questions ouvertes disponibles pour cet examen." });
    }
    res.json(questions);
  } catch (err) {
    console.error("Erreur lors de la récupération des questions :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Route pour récupérer les matières
app.get("/api/matieres", authenticate, async (req, res) => {
  try {
    const [matieres] = await pool.query("SELECT id, nom FROM matieres");
    res.json(matieres);
  } catch (err) {
    console.error("Erreur lors de la récupération des matières :", err.message);
    res.status(500).send("Erreur serveur.");
  }
});

// Route pour créer un examen
app.post("/api/exams", authenticate, async (req, res) => {
  const { title, matiere_id, date_debut, duration, questions, students } = req.body;
  const createur_id = req.user.id;
  if (!title || !matiere_id || !date_debut || !duration || !questions.length || !students.length) {
    return res.status(400).send("Tous les champs obligatoires sont requis.");
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insérer l'examen
    const [examResult] = await connection.query(
      `INSERT INTO examens (titre, matiere_id, createur_id, date_debut, duree, statut)
       VALUES (?, ?, ?, ?, ?, 'brouillon')`,
      [title, matiere_id, createur_id, date_debut, duration]
    );
    const exam_id = examResult.insertId;

    // Insérer les étudiants dans utilisateurs et examen_etudiants
    for (const student of students) {
      const [userResult] = await connection.query(
        `INSERT INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe)
         VALUES (?, ?, ?, ?, ?, 'Inconnu', 'Inconnue', 'etudiant', 'default_password')
         ON DUPLICATE KEY UPDATE nom = ?, prenom = ?, date_naissance = ?, sexe = ?`,
        [
          student.email, student.nom, student.prenom, student.date_naissance, student.sexe,
          student.nom, student.prenom, student.date_naissance, student.sexe
        ]
      );
      const utilisateur_id = userResult.insertId || (await connection.query(
        `SELECT id FROM utilisateurs WHERE email = ?`,
        [student.email]
      ))[0][0].id;

      await connection.query(
        `INSERT INTO examen_etudiants (examen_id, utilisateur_id) VALUES (?, ?)`,
        [exam_id, utilisateur_id]
      );
    }

    // Insérer les questions et choix
    for (const q of questions) {
      const [questionResult] = await connection.query(
        `INSERT INTO questions (examen_id, texte, type, reponse_attendue, points, time_limit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [exam_id, q.text, q.type === 'qcm' ? 'QCM' : 'OUVERTE', q.reponse_attendue || null, q.points, q.time_limit]
      );
      const question_id = questionResult.insertId;

      if (q.type === 'qcm') {
        for (let i = 0; i < q.options.length; i++) {
          await connection.query(
            `INSERT INTO choix (question_id, texte, correct)
             VALUES (?, ?, ?)`,
            [question_id, q.options[i], i === q.correctOption]
          );
        }
      }
    }

    await connection.commit();
    res.json({ message: "Examen créé avec succès", exam_id });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Erreur lors de la création de l'examen :", err.message);
    res.status(500).send(`Erreur : ${err.message}`);
  } finally {
    if (connection) connection.release();
  }
});

// Route pour vérifier la réponse
app.post("/verifier", async (req, res) => {
  console.log("Requête POST /verifier reçue");
  const { question_id, etudiant, note, examen_id, utilisateur_id, question_index } = req.body;
  console.log("Données du formulaire :", { question_id, etudiant, note, examen_id, utilisateur_id, question_index });

  if (!question_id || !etudiant || !note || !examen_id || !utilisateur_id || question_index === undefined) {
    console.log("Données manquantes dans le formulaire");
    return res.status(400).send("Toutes les données du formulaire sont requises.");
  }

  try {
    // Supprimer les anciennes soumissions pour cette question et cet utilisateur
    await pool.query(
      `DELETE FROM soumissions WHERE utilisateur_id = ? AND question_id = ?`,
      [utilisateur_id, question_id]
    );
    console.log(`Anciennes soumissions supprimées pour utilisateur_id=${utilisateur_id}, question_id=${question_id}`);

    // Récupérer la question et la réponse attendue
    const [questions] = await pool.query(
      `SELECT texte, reponse_attendue FROM questions WHERE id = ?`,
      [question_id]
    );
    if (questions.length === 0) {
      console.error(`Question introuvable pour question_id=${question_id}`);
      return res.status(404).send("Question introuvable.");
    }
    const question = questions[0].texte;
    const reponse_attendue = questions[0].reponse_attendue;

    if (!reponse_attendue) {
      console.error(`Réponse attendue non définie pour question_id=${question_id}`);
      return res.status(500).send("Réponse attendue non définie pour cette question.");
    }

    // Évaluer la réponse avec Gemini
    const prompt = `
      Tu es un correcteur d'examen bienveillant.
      Voici une question : "${question}"
      Réponse attendue : "${reponse_attendue}"
      Réponse de l'étudiant : "${etudiant}"
      Points de la question : "${note}"
      Évalue la réponse de l'étudiant en attribuant un pourcentage de correction (0 à 100 %),
      même si la formulation diffère. Si le pourcentage est supérieur à 89 %, attribue 100 %.
      Retourne uniquement le pourcentage (ex. "95" pour 95 %) sans explication.
    `;
    console.log("Prompt envoyé à Gemini :", prompt);

    const result = await model.generateContent(prompt);
    const texte = await result.response.text();
    console.log("Réponse de Gemini :", texte);
    const percentage = parseFloat(texte);
    const score = (percentage / 100) * parseFloat(note); // Ex. 95 % de 5 = 4.75
    console.log(`Score calculé : ${score}/${note} (pourcentage : ${percentage}%)`);

    // Enregistrer la soumission
    await pool.query(
      `INSERT INTO soumissions (utilisateur_id, question_id, reponse_texte, score)
       VALUES (?, ?, ?, ?)`,
      [utilisateur_id, question_id, etudiant, score]
    );
    console.log(`Soumission enregistrée : utilisateur_id=${utilisateur_id}, question_id=${question_id}, score=${score}`);

    // Vérifier si c'est la dernière question
    const questionIndex = parseInt(question_index, 10);
    if (questionIndex === 1) { // Deuxième question (index 1)
      // Calculer la note finale pour les deux questions
      const [soumissions] = await pool.query(
        `SELECT score FROM soumissions WHERE utilisateur_id = ? AND question_id IN (
          SELECT id FROM questions WHERE examen_id = ?
        ) ORDER BY submitted_at DESC LIMIT 2`,
        [utilisateur_id, examen_id]
      );
      const total_score = soumissions.reduce((sum, s) => sum + s.score, 0) || 0;
      console.log(`Soumissions pour note finale :`, soumissions);
      console.log(`Note finale calculée : ${total_score}/10`);

      // Enregistrer le résultat
      await pool.query(
        `INSERT INTO resultats (utilisateur_id, examen_id, score)
         VALUES (?, ?, ?)`,
        [utilisateur_id, examen_id, total_score]
      );

      res.send(`
        <h2>Examen terminé !</h2>
        <p>Votre note finale : ${total_score}/10</p>
        <a href="/">↩ Recommencer</a>
      `);
    } else {
      res.send(`
        <h2>Résultat :</h2>
        <p>Score : ${score}/${note}</p>
        <a href="/?examen_id=${examen_id}&question_index=${questionIndex + 1}&utilisateur_id=${utilisateur_id}">↪ Passer à la question suivante</a>
      `);
    }
  } catch (err) {
    console.error("Erreur lors du traitement :", err.message);
    res.status(500).send(`Erreur : ${err.message}`);
  }
});

// Route pour l'inscription
app.post("/api/register", async (req, res) => {
  const { email, nom, prenom, date_naissance, sexe, role, mot_de_passe } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
    const [result] = await pool.query(
      `INSERT INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe)
       VALUES (?, ?, ?, ?, ?, 'Inconnu', 'Inconnue', ?, ?)`,
      [email, nom, prenom, date_naissance, sexe, role, hashedPassword]
    );
    res.json({ message: "Utilisateur créé", id: result.insertId });
  } catch (err) {
    console.error("Erreur lors de l'inscription :", err.message);
    res.status(500).send("Erreur lors de l'inscription.");
  }
});

// Route pour la connexion
app.post("/api/login", async (req, res) => {
  const { email, mot_de_passe } = req.body;
  try {
    const [users] = await pool.query(`SELECT * FROM utilisateurs WHERE email = ?`, [email]);
    if (users.length === 0) return res.status(401).send("Utilisateur non trouvé.");
    const user = users[0];
    if (await bcrypt.compare(mot_de_passe, user.mot_de_passe)) {
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
      res.json({ token });
    } else {
      res.status(401).send("Mot de passe incorrect.");
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err.message);
    res.status(500).send("Erreur lors de la connexion.");
  }
});

// Gestion des erreurs pour les routes non trouvées
app.use((req, res) => {
  console.log(`Route non trouvée : ${req.method} ${req.url}`);
  res.status(404).send("The requested resource was not found on this server.");
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