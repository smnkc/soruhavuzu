const { ipcRenderer } = require('electron');

// Event Listeners - Sadece bir kez çalışacak
document.addEventListener('DOMContentLoaded', () => {
    // Filtre değişikliklerini dinle
    document.getElementById('classLevel').addEventListener('change', loadQuestions);
    document.getElementById('examType').addEventListener('change', loadQuestions);
    
    // Modal kapatma olayını dinle
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeEditModal();
            closeAddModal();
        }
    });

    // İlk yüklemeyi yap
    loadQuestions();
});

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Helper function to get exam type text
function getExamTypeText(examType) {
    const [term, exam] = examType.split('-');
    return `${term}. Dönem ${exam}. Yazılı`;
}

async function loadQuestions() {
    const classLevel = document.getElementById('classLevel').value;
    const examType = document.getElementById('examType').value;
    
    try {
        const data = await ipcRenderer.invoke('get-all-questions');
        let questions = data.questions || [];

        // Filtreleri uygula
        if (classLevel) {
            questions = questions.filter(q => q.class_level === classLevel);
        }
        if (examType) {
            questions = questions.filter(q => q.unit === examType);
        }

        displayQuestions(questions);
    } catch (error) {
        console.error('Error loading questions:', error);
        showNotification('Sorular yüklenirken bir hata oluştu.', 'error');
        displayQuestions([]);
    }
}

function displayQuestions(questions) {
    const container = document.getElementById('questionList');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p>Bu kriterlere uygun soru bulunamadı.</p>';
        return;
    }

    questions.forEach(question => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <div class="question-header">
                <div class="question-info">
                    ${question.class_level}. Sınıf - ${getExamTypeText(question.unit)}
                </div>
                <div class="question-actions">
                    <button onclick="editQuestion(${question.id})" class="btn btn-primary">Düzenle</button>
                    <button onclick="deleteQuestion(${question.id})" class="btn btn-danger">Sil</button>
                </div>
            </div>
            <div class="question-content">
                <p><strong>Soru:</strong> ${escapeHtml(question.question_text)}</p>
                <p><strong>Cevap:</strong> ${escapeHtml(question.answer_text)}</p>
            </div>
        `;
        container.appendChild(questionDiv);
    });
}

async function deleteQuestion(id) {
    if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        const result = await ipcRenderer.invoke('delete-question', id);
        if (result) {
            showNotification('Soru başarıyla silindi.', 'success');
            await loadQuestions();
            resetForm();
        } else {
            showNotification('Soru silinirken bir hata oluştu.', 'error');
        }
    } catch (error) {
        console.error('Error deleting question:', error);
        showNotification('Soru silinirken bir hata oluştu.', 'error');
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Form alanlarını sıfırla
function resetForm() {
    const modal = document.getElementById('addModal');
    if (!modal) return;

    // Form alanlarını temizle
    const questionInput = document.getElementById('addQuestionText');
    const answerInput = document.getElementById('addAnswerText');
    
    if (questionInput) {
        questionInput.value = '';
        questionInput.disabled = false;
    }
    
    if (answerInput) {
        answerInput.value = '';
        answerInput.disabled = false;
    }

    // Sınıf seviyesi ve sınav türünü varsayılan değerlere ayarla
    const classLevelSelect = document.getElementById('addClassLevel');
    const examTypeSelect = document.getElementById('addExamType');
    
    if (classLevelSelect) classLevelSelect.value = '10';
    if (examTypeSelect) examTypeSelect.value = '1-1';

    // Modal'ı gizle
    modal.style.display = 'none';
}

// Soru ekleme modalını aç
function openAddModal() {
    const modal = document.getElementById('addModal');
    if (!modal) return;
    
    // Form alanlarını sıfırla ve etkinleştir
    const questionInput = document.getElementById('addQuestionText');
    const answerInput = document.getElementById('addAnswerText');
    
    if (questionInput) {
        questionInput.value = '';
        questionInput.disabled = false;
    }
    
    if (answerInput) {
        answerInput.value = '';
        answerInput.disabled = false;
    }
    
    // Modal'ı göster
    modal.style.display = 'block';
    
    // Soru alanına odaklan
    if (questionInput) questionInput.focus();
}

// Soru ekleme modalını kapat
function closeAddModal() {
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.style.display = 'none';
        resetForm();
    }
}

// Yeni soru kaydet
async function saveNewQuestion() {
    const classLevelSelect = document.getElementById('addClassLevel');
    const examTypeSelect = document.getElementById('addExamType');
    const questionInput = document.getElementById('addQuestionText');
    const answerInput = document.getElementById('addAnswerText');

    // Form elemanlarının varlığını kontrol et
    if (!classLevelSelect || !examTypeSelect || !questionInput || !answerInput) {
        showNotification('Form alanları bulunamadı.', 'error');
        return;
    }

    const classLevel = classLevelSelect.value;
    const examType = examTypeSelect.value;
    const questionText = questionInput.value.trim();
    const answerText = answerInput.value.trim();

    if (!classLevel || !examType || !questionText || !answerText) {
        showNotification('Lütfen tüm alanları doldurun.', 'warning');
        return;
    }

    try {
        // Form alanlarını devre dışı bırak
        questionInput.disabled = true;
        answerInput.disabled = true;

        const result = await ipcRenderer.invoke('save-question', {
            classLevel,
            unit: examType,
            questionText,
            answerText
        });

        if (result.success) {
            showNotification('Soru başarıyla eklendi.', 'success');
            closeAddModal();
            await loadQuestions();
        } else {
            showNotification('Soru eklenirken bir hata oluştu: ' + result.error, 'error');
            // Hata durumunda form alanlarını tekrar etkinleştir
            questionInput.disabled = false;
            answerInput.disabled = false;
        }
    } catch (error) {
        console.error('Error adding question:', error);
        showNotification('Soru eklenirken bir hata oluştu.', 'error');
        // Hata durumunda form alanlarını tekrar etkinleştir
        questionInput.disabled = false;
        answerInput.disabled = false;
    }
}

// Düzenleme modalını aç
function editQuestion(id) {
    const questionItem = document.querySelector(`.question-item button[onclick="editQuestion(${id})"]`)
        .closest('.question-item');
    
    if (!questionItem) return;

    const questionText = questionItem.querySelector('.question-content p:first-child')
        .textContent.replace('Soru: ', '');
    const answerText = questionItem.querySelector('.question-content p:last-child')
        .textContent.replace('Cevap: ', '');
    const classLevel = questionItem.querySelector('.question-info')
        .textContent.split('.')[0].trim();
    const examType = questionItem.querySelector('.question-info')
        .textContent.split('-')[1].trim();

    // Modal HTML'ini oluştur
    const modalHtml = `
        <div id="editModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Soru Düzenle</h2>
                    <span class="close" onclick="closeEditModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="editClassLevel">Sınıf Seviyesi:</label>
                        <select id="editClassLevel">
                            <option value="10">10. Sınıf</option>
                            <option value="11">11. Sınıf</option>
                            <option value="12">12. Sınıf</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editExamType">Sınav Türü:</label>
                        <select id="editExamType">
                            <option value="1-1">1. Dönem 1. Yazılı</option>
                            <option value="1-2">1. Dönem 2. Yazılı</option>
                            <option value="2-1">2. Dönem 1. Yazılı</option>
                            <option value="2-2">2. Dönem 2. Yazılı</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editQuestionText">Soru:</label>
                        <textarea id="editQuestionText" required>${questionText}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="editAnswerText">Cevap:</label>
                        <textarea id="editAnswerText" required>${answerText}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveEditedQuestion(${id})" class="btn btn-primary">Kaydet</button>
                    <button onclick="closeEditModal()" class="btn btn-secondary">İptal</button>
                </div>
            </div>
        </div>
    `;

    // Modalı ekle ve göster
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('editModal');
    modal.style.display = 'block';

    // Mevcut değerleri seç
    document.getElementById('editClassLevel').value = classLevel;
    document.getElementById('editExamType').value = getExamTypeFromText(examType);
}

// Düzenlenen soruyu kaydet
async function saveEditedQuestion(id) {
    const questionData = {
        id: id,
        classLevel: document.getElementById('editClassLevel').value,
        unit: document.getElementById('editExamType').value,
        questionText: document.getElementById('editQuestionText').value.trim(),
        answerText: document.getElementById('editAnswerText').value.trim()
    };

    if (!questionData.questionText || !questionData.answerText) {
        showNotification('Lütfen tüm alanları doldurun.', 'warning');
        return;
    }

    try {
        await ipcRenderer.invoke('update-question', questionData);
        showNotification('Soru başarıyla güncellendi.', 'success');
        closeEditModal();
        loadQuestions();
    } catch (error) {
        console.error('Error updating question:', error);
        showNotification('Soru güncellenirken bir hata oluştu.', 'error');
    }
}

// Düzenleme modalını kapat
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
}

// Sınav türü metninden değeri al
function getExamTypeFromText(text) {
    const examTypes = {
        '1. Dönem 1. Yazılı': '1-1',
        '1. Dönem 2. Yazılı': '1-2',
        '2. Dönem 1. Yazılı': '2-1',
        '2. Dönem 2. Yazılı': '2-2'
    };
    return examTypes[text.trim()] || '1-1';
}

// Ana sayfaya dön
function goToMainPage() {
    window.location.href = 'index.html';
}