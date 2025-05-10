DROP DATABASE IF EXISTS examen_en_ligne;
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
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des matières
CREATE TABLE matieres (
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
    date_debut DATETIME NOT NULL,
    duree INT NOT NULL,
    statut ENUM('brouillon', 'actif', 'termine') DEFAULT 'brouillon',
    FOREIGN KEY (matiere_id) REFERENCES matieres(id),
    FOREIGN KEY (createur_id) REFERENCES utilisateurs(id)
);

-- Table des questions (avec reponse_attendue)
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    examen_id INT NOT NULL,
    texte TEXT NOT NULL,
    type ENUM('QCM', 'OUVERTE') NOT NULL,
    reponse_attendue TEXT,
    points INT NOT NULL,
    time_limit INT NOT NULL DEFAULT 60,
    FOREIGN KEY (examen_id) REFERENCES examens(id)
);

-- Table des choix (pour QCM)
CREATE TABLE choix (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    texte VARCHAR(255) NOT NULL,
    correct BOOLEAN NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Table des soumissions
CREATE TABLE soumissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    question_id INT NOT NULL,
    reponse_texte TEXT,
    choix_id INT,
    score FLOAT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
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

-- Table des associations examen-étudiants
CREATE TABLE examen_etudiants (
    examen_id INT,
    utilisateur_id INT,
    PRIMARY KEY (examen_id, utilisateur_id),
    FOREIGN KEY (examen_id) REFERENCES examens(id),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- Données de test
INSERT IGNORE INTO utilisateurs (email, nom, prenom, date_naissance, sexe, etablissement, filiere, role, mot_de_passe)
VALUES ('prof@exemple.com', 'Doe', 'John', '1980-01-01', 'masculin', 'Université', 'Informatique', 'professeur', '$2a$10$your_hashed_password'),
       ('etudiant@exemple.com', 'Smith', 'Jane', '2000-01-01', 'feminin', 'Université', 'Informatique', 'etudiant', '$2a$10$your_hashed_password');

INSERT INTO matieres (nom, description) VALUES ('Mathématiques', 'Cours de mathématiques');

INSERT INTO examens (titre, matiere_id, createur_id, date_debut, duree, statut)
VALUES ('Examen de Maths', 1, 1, '2025-05-11 10:00:00', 60, 'actif');

INSERT INTO questions (examen_id, texte, type, reponse_attendue, points, time_limit)
VALUES (1, 'Quelle est la capitale de la France ?', 'OUVERTE', 'Paris', 5, 60),
       (1, 'Combien font 2 + 2 ?', 'OUVERTE', '4', 5, 60);

INSERT INTO examen_etudiants (examen_id, utilisateur_id) VALUES (1, 2);