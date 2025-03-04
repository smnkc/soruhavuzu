const { ipcRenderer } = require('electron');
const { Document, Paragraph, HeadingLevel, Packer, AlignmentType, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('classLevel').addEventListener('change', updatePreview);
    document.getElementById('examType').addEventListener('change', updatePreview);
    updatePreview(); // İlk yükleme için
});

// Helper Functions
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

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getExamTypeText(examType) {
    const [term, exam] = examType.split('-');
    return `${term}. Dönem ${exam}. Yazılı`;
}

function openQuestionPool() {
    window.location.href = 'question-management.html';
}

// Update preview when selections change
async function updatePreview() {
    const classLevel = document.getElementById('classLevel').value;
    const examType = document.getElementById('examType').value;
    const previewContainer = document.getElementById('previewContainer');

    if (!classLevel || !examType) {
        showNotification('Lütfen sınıf seviyesi ve sınav türünü seçin.', 'warning');
        previewContainer.innerHTML = '<p>Lütfen sınıf seviyesi ve sınav türünü seçin.</p>';
        return;
    }

    try {
        const data = await ipcRenderer.invoke('get-all-questions');
        const questions = data.questions.filter(q => 
            q.class_level === classLevel && 
            q.unit === examType
        );

        if (questions.length === 0) {
            showNotification('Seçilen kriterlere uygun soru bulunamadı.', 'info');
            previewContainer.innerHTML = '<p>Seçilen sınıf seviyesi ve sınav türü için soru bulunmamaktadır.</p>';
            return;
        }

        const examTitle = `${classLevel}. Sınıf - ${getExamTypeText(examType)}`;
        const questionsHtml = questions.map((q, index) => `
            <div class="question-item">
                <label class="question-checkbox">
                    <input type="checkbox" name="selectedQuestions" value="${index}" checked>
                    <div class="question-content">
                        <p><strong>${index + 1}. ${escapeHtml(q.question_text)}</strong></p>
                        <p>Cevap: ${escapeHtml(q.answer_text)}</p>
                    </div>
                </label>
            </div>
        `).join('');

        previewContainer.innerHTML = `
            <h3>${examTitle}</h3>
            ${questionsHtml}
            <button onclick="createExam()" class="btn btn-primary create-exam-btn">Sınav Oluştur</button>
        `;
    } catch (error) {
        console.error('Error loading questions:', error);
        showNotification('Sorular yüklenirken bir hata oluştu.', 'error');
        previewContainer.innerHTML = '<p>Sorular yüklenirken bir hata oluştu.</p>';
    }
}

// Create exam
async function createExam() {
    const classLevel = document.getElementById('classLevel').value;
    const examType = document.getElementById('examType').value;
    const schoolName = document.getElementById('schoolName').value.trim().toUpperCase();
    const academicYear = document.getElementById('academicYear').value.trim() || '2024-2025';
    const lessonName = document.getElementById('lessonName').value.trim().toUpperCase() || 'FELSEFE';

    if (!classLevel || !examType) {
        showNotification('Lütfen sınıf seviyesi ve sınav türünü seçin.', 'warning');
        return;
    }

    if (!schoolName) {
        showNotification('Lütfen okul ismini giriniz.', 'warning');
        return;
    }

    try {
        const data = await ipcRenderer.invoke('get-all-questions');
        const questions = data.questions.filter(q => 
            q.class_level === classLevel && 
            q.unit === examType
        );

        if (questions.length === 0) {
            showNotification('Seçilen sınıf seviyesi ve sınav türü için soru bulunmamaktadır.', 'warning');
            return;
        }

        const selectedCheckboxes = document.querySelectorAll('input[name="selectedQuestions"]:checked');
        if (selectedCheckboxes.length === 0) {
            showNotification('Lütfen en az bir soru seçin.', 'warning');
            return;
        }

        const selectedQuestions = Array.from(selectedCheckboxes).map(checkbox => 
            questions[parseInt(checkbox.value)]);

        // Create Word document
        await createWordDocument(selectedQuestions, classLevel, examType, schoolName, academicYear, lessonName);
    } catch (error) {
        console.error('Error creating exam:', error);
        showNotification('Sınav oluşturulurken bir hata oluştu.', 'error');
    }
}

// Create Word document
async function createWordDocument(questions, classLevel, examType, schoolName, academicYear, lessonName) {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Öğrenci Bilgileri
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Adı Soyadı : ",
                                size: 20,
                                bold: true,
                                color: "000000"
                            }),
                            new TextRun({
                                text: "\t\t\t\t\t\t\t\t\t\t",
                            }),
                            new TextRun({
                                text: "Aldığı puan : ",
                                size: 20,
                                bold: true,
                                color: "000000"
                            })
                        ],
                        spacing: {
                            after: 100
                        }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Numarası : ",
                                size: 20,
                                bold: true,
                                color: "000000"
                            })
                        ],
                        spacing: {
                            after: 100
                        }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Sınıfı : ",
                                size: 20,
                                bold: true,
                                color: "000000"
                            })
                        ],
                        spacing: {
                            after: 200
                        }
                    }),
                    new Paragraph({
                        spacing: {
                            before: 200,
                            after: 200
                        }
                    }),
                    // Yıl ve Okul Başlığı
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${academicYear} EĞİTİM-ÖĞRETİM YILI\n`,
                                size: 24,
                                bold: true,
                                color: "000000"
                            }),
                            new TextRun({
                                text: schoolName + "\n",
                                size: 24,
                                bold: true,
                                color: "000000"
                            }),
                            new TextRun({
                                text: `${classLevel}.SINIF ${lessonName} DERSİ ${examType.split('-')[0]}.DÖNEM ${examType.split('-')[1]}.YAZILI\n`,
                                size: 24,
                                bold: true,
                                color: "000000"
                            }),
                            new TextRun({
                                text: "SINAV SORULARI",
                                size: 24,
                                bold: true,
                                color: "000000"
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            after: 200,
                            line: 300
                        }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'SORULAR',
                                size: 20,
                                bold: true,
                                color: "000000",
                                underline: {}
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            before: 200,
                            after: 200
                        }
                    }),
                    ...questions.map((q, index) => 
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `${index + 1}. ${q.question_text}`,
                                    size: 20,
                                    color: "000000"
                                })
                            ],
                            spacing: {
                                before: 100,
                                after: 100
                            }
                        })
                    ),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'CEVAP ANAHTARI',
                                size: 20,
                                bold: true,
                                color: "000000",
                                underline: {}
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }),
                    ...questions.map((q, index) => 
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `${index + 1}. ${q.answer_text}`,
                                    size: 16,
                                    color: "000000"
                                })
                            ],
                            spacing: {
                                before: 100,
                                after: 100
                            }
                        })
                    )
                ]
            }]
        });

        // Save document
        const buffer = await Packer.toBuffer(doc);
        const [term, exam] = examType.split('-');
        const fileName = `${classLevel}.Sınıf ${lessonName} ${term}.Dönem ${exam}.Yazılı.docx`;
        
        // Kullanıcıya kaydetme yerini seçtir
        const result = await ipcRenderer.invoke('show-save-dialog', {
            defaultPath: fileName
        });

        if (!result.canceled && result.filePath) {
            try {
                fs.writeFileSync(result.filePath, buffer);
                showNotification(`Sınav başarıyla oluşturuldu: ${path.basename(result.filePath)}`, 'success');

                // Save exam record
                await ipcRenderer.invoke('save-exam', {
                    classLevel,
                    examType,
                    filePath: result.filePath,
                    date: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error writing file:', error);
                showNotification('Dosya kaydedilirken bir hata oluştu.', 'error');
            }
        }
    } catch (error) {
        console.error('Error creating document:', error);
        showNotification('Sınav dosyası oluşturulurken bir hata oluştu.', 'error');
    }
}