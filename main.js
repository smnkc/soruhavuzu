const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Uygulama veri dizinini oluştur
const appDataPath = path.join(app.getPath('documents'), 'Sınav Hazırlama');

if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
}

// Soru havuzu dosyası yolu
const questionPoolPath = path.join(appDataPath, 'questionPool.json');
// Sınav kayıtları dosyası yolu
const examRecordsPath = path.join(appDataPath, 'examRecords.json');

// Dosyaları oluştur (eğer yoksa)
if (!fs.existsSync(questionPoolPath)) {
    fs.writeFileSync(questionPoolPath, JSON.stringify({ questions: [] }));
}
if (!fs.existsSync(examRecordsPath)) {
    fs.writeFileSync(examRecordsPath, JSON.stringify({ exams: [] }));
}

// GPU ayarlarını başlangıçta yap
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        backgroundColor: '#ffffff'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC handlers
ipcMain.handle('get-all-questions', () => {
    try {
        if (!fs.existsSync(questionPoolPath)) {
            fs.writeFileSync(questionPoolPath, JSON.stringify({ questions: [] }));
            return { questions: [] };
        }
        const data = fs.readFileSync(questionPoolPath, 'utf8');
        try {
            const parsed = JSON.parse(data);
            return parsed.questions ? parsed : { questions: [] };
        } catch (e) {
            fs.writeFileSync(questionPoolPath, JSON.stringify({ questions: [] }));
            return { questions: [] };
        }
    } catch (error) {
        console.error('Error reading question pool:', error);
        return { questions: [] };
    }
});

ipcMain.handle('save-question', (event, question) => {
    try {
        let questionPool = { questions: [] };
        if (fs.existsSync(questionPoolPath)) {
            const data = fs.readFileSync(questionPoolPath, 'utf8');
            try {
                questionPool = JSON.parse(data);
                if (!questionPool.questions) {
                    questionPool.questions = [];
                }
            } catch (e) {
                questionPool = { questions: [] };
            }
        }

        const newQuestion = {
            id: Date.now(),
            class_level: question.classLevel,
            unit: question.unit,
            question_text: question.questionText,
            answer_text: question.answerText,
            created_at: new Date().toISOString()
        };
        questionPool.questions.push(newQuestion);
        fs.writeFileSync(questionPoolPath, JSON.stringify(questionPool, null, 2));
        return { success: true, question: newQuestion };
    } catch (error) {
        console.error('Error saving question:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-question', async (event, question) => {
    try {
        const data = fs.readFileSync(questionPoolPath, 'utf8');
        const questionPool = JSON.parse(data);
        const index = questionPool.questions.findIndex(q => q.id === parseInt(question.id));
        
        if (index !== -1) {
            questionPool.questions[index] = {
                ...questionPool.questions[index],
                class_level: question.classLevel,
                unit: question.unit,
                question_text: question.questionText,
                answer_text: question.answerText,
                updated_at: new Date().toISOString()
            };
            fs.writeFileSync(questionPoolPath, JSON.stringify(questionPool, null, 2));
            return questionPool.questions[index];
        }
        return false;
    } catch (error) {
        console.error('Error updating question:', error);
        return false;
    }
});

ipcMain.handle('delete-question', async (event, questionId) => {
    try {
        if (!fs.existsSync(questionPoolPath)) {
            fs.writeFileSync(questionPoolPath, JSON.stringify({ questions: [] }));
            return true;
        }
        const data = fs.readFileSync(questionPoolPath, 'utf8');
        let questionPool;
        try {
            questionPool = JSON.parse(data);
            if (!questionPool.questions) {
                questionPool.questions = [];
            }
        } catch (e) {
            questionPool = { questions: [] };
        }
        
        // questionId'yi number'a çevir
        const numericId = parseInt(questionId);
        questionPool.questions = questionPool.questions.filter(q => q.id !== numericId);
        
        fs.writeFileSync(questionPoolPath, JSON.stringify(questionPool, null, 2));
        return true;
    } catch (error) {
        console.error('Error deleting question:', error);
        return false;
    }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const win = BrowserWindow.getFocusedWindow();
    return await dialog.showSaveDialog(win, {
        title: 'Sınavı Kaydet',
        defaultPath: options.defaultPath,
        filters: [
            { name: 'Word Belgesi', extensions: ['docx'] }
        ]
    });
});

ipcMain.handle('save-exam', (event, examRecord) => {
    try {
        const data = fs.readFileSync(examRecordsPath, 'utf8');
        const examRecords = JSON.parse(data);
        examRecords.exams.push(examRecord);
        fs.writeFileSync(examRecordsPath, JSON.stringify(examRecords, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving exam record:', error);
        return false;
    }
});