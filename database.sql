CREATE DATABASE examen_en_ligne;
USE examen_en_ligne;

-- Table des utilisateurs
CREATE TABLE utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE NOT NULL,
    sexe ENUM('masculin', 'feminin') NOT NULL,
    etablissement VARCHAR(255) NOT NULL,
    filiere VARCHAR(100) NOT NULL,
    role ENUM('etudiant', 'professeur') NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NULL,
    longitude DECIMAL(9,6) NULL,
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des matières
CREATE TABLE matieres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT
);

-- Table des publics cibles
CREATE TABLE publics_cibles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT
);

-- Table des examens
CREATE TABLE examens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    matiere_id INT NOT NULL,
    createur_id INT NOT NULL,
    filiere_cible VARCHAR(100) NOT NULL,
    date_debut DATETIME NOT NULL,
    duree INT NOT NULL,
    statut ENUM('brouillon', 'actif', 'termine') DEFAULT 'brouillon',
    webcam BOOLEAN NOT NULL,
    plein_ecran BOOLEAN NOT NULL,
    anti_ia BOOLEAN NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    FOREIGN KEY (matiere_id) REFERENCES matieres(id),
    FOREIGN KEY (createur_id) REFERENCES utilisateurs(id)
);

-- Table de liaison entre examens et publics cibles
CREATE TABLE examen_publics_cibles (
    examen_id INT NOT NULL,
    public_cible_id INT NOT NULL,
    PRIMARY KEY (examen_id, public_cible_id),
    FOREIGN KEY (examen_id) REFERENCES examens(id),
    FOREIGN KEY (public_cible_id) REFERENCES publics_cibles(id)
);

-- Table des questions
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    examen_id INT NOT NULL,
    texte TEXT NOT NULL,
    type ENUM('QCM', 'OUVERTE') NOT NULL,
    points INT NOT NULL,
    reponse_attendue TEXT,
    temps_limite INT,
    FOREIGN KEY (examen_id) REFERENCES examens(id)
);

-- Table des choix
CREATE TABLE choix (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    texte VARCHAR(255) NOT NULL,
    correct BOOLEAN NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Table des réponses
CREATE TABLE reponses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    examen_id INT NOT NULL,
    question_id INT NOT NULL,
    reponse_texte TEXT,
    choix_id INT,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME,
    statut ENUM('en_cours', 'termine') DEFAULT 'en_cours',
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (examen_id) REFERENCES examens(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (choix_id) REFERENCES choix(id)
);

-- Table des résultats
CREATE TABLE resultats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    examen_id INT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    date_completion DATETIME DEFAULT CURRENT_TIMESTAMP,
    commentaires TEXT,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (examen_id) REFERENCES examens(id)
);

-- Table des tentatives
CREATE TABLE tentatives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    examen_id INT NOT NULL,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME,
    statut ENUM('en_cours', 'termine') DEFAULT 'en_cours',
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (examen_id) REFERENCES examens(id)
);

-- Table des notifications
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    examen_id INT NOT NULL,
    message TEXT NOT NULL,
    statut ENUM('envoye', 'lu', 'expire') DEFAULT 'envoye',
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (examen_id) REFERENCES examens(id)
);

-- Table des soumissions (ajoutée pour /verifier)
CREATE TABLE soumissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    question_id INT NOT NULL,
    reponse_texte TEXT,
    choix_id INT,
    score DECIMAL(5,2),
    date_soumission DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (choix_id) REFERENCES choix(id)
);

-- Table de liaison entre examens et étudiants
CREATE TABLE examen_etudiants (
    examen_id INT NOT NULL,
    utilisateur_id INT NOT NULL,
    PRIMARY KEY (examen_id, utilisateur_id),
    FOREIGN KEY (examen_id) REFERENCES examens(id),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);