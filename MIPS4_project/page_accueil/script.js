// Fonction pour valider et enregistrer un etudiant
function registerStudent(event) {
    event.preventDefault(); // Empeche le rechargement de la page

    // Recuperer les valeurs du formulaire
    const name = document.getElementById("studentName").value;
    const email = document.getElementById("studentEmail").value;
    const password = document.getElementById("studentPassword").value;

    // Validation simple
    if (name.length < 3) {
        alert("Le nom doit contenir au moins 3 caractères.");
        return;
    }
    if (!email.includes("@") || !email.includes(".")) {
        alert("Veuillez entrer un email valide.");
        return;
    }
    if (password.length < 6) {
        alert("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    // Simuler l'enregistrement (stockage dans localStorage)
    const student = { name, email, password, role: "student" };
    let students = JSON.parse(localStorage.getItem("students")) || [];
    students.push(student);
    localStorage.setItem("students", JSON.stringify(students));

    // Afficher un message de succes
    alert("Inscription étudiant réussie !");
    document.getElementById("studentForm").reset(); // Reinitialiser le formulaire
}

// Fonction pour valider et enregistrer un enseignant
function registerTeacher(event) {
    event.preventDefault(); // Empêche le rechargement de la page

    // Recuperer les valeurs du formulaire
    const name = document.getElementById("teacherName").value;
    const email = document.getElementById("teacherEmail").value;
    const password = document.getElementById("teacherPassword").value;
    const institution = document.getElementById("institution").value;

    // Validation simple
    if (name.length < 3) {
        alert("Le nom doit contenir au moins 3 caractères.");
        return;
    }
    if (!email.includes("@") || !email.includes(".")) {
        alert("Veuillez entrer un email valide.");
        return;
    }
    if (password.length < 6) {
        alert("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }
    if (institution.length < 2) {
        alert("L'établissement doit contenir au moins 2 caractères.");
        return;
    }

    // Simuler l'enregistrement (stockage dans localStorage)
    const teacher = { name, email, password, institution, role: "teacher" };
    let teachers = JSON.parse(localStorage.getItem("teachers")) || [];
    teachers.push(teacher);
    localStorage.setItem("teachers", JSON.stringify(teachers));

    // Afficher un message de succes
    alert("Inscription enseignant réussie !");
    document.getElementById("teacherForm").reset(); // Reinitialiser le formulaire
}