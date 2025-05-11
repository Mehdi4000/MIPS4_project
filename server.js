const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Connexion à la base de données MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'examen_en_ligne'
});

db.connect(err => {
  if (err) throw err;
  console.log('Connecté à la base de données MySQL');
});

// pour l'inscription
app.post('/signup', async (req, res) => {
  const { email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe } = req.body;

  try {
    // Vérifier si l'email existe déjà
    const [existingUser] = await db.promise().query('SELECT * FROM utilisateurs WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

    // Insérer l'utilisateur dans la base de données
    await db.promise().query(
      'INSERT INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, hashedPassword]
    );

    res.status(201).json({ message: 'Inscription réussie !' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Route pour la connexion
app.post('/login', async (req, res) => {
  const { email, mot_de_passe } = req.body;

  try {
    // Vérifier si l'utilisateur existe
    const [user] = await db.promise().query('SELECT * FROM utilisateurs WHERE email = ?', [email]);
    if (user.length === 0) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(mot_de_passe, user[0].mot_de_passe);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
    }

    // Générer un token JWT
    const token = jwt.sign({ id: user[0].id, role: user[0].role }, 'votre_clé_secrète', { expiresIn: '1h' });

    res.json({ token, user: { id: user[0].id, email: user[0].email, role: user[0].role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.listen(3000, () => {
  console.log('Serveur démarré sur le port 3000');
});