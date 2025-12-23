import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { SupaworkService } from '../src/services/SupaworkService';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Memory storage untuk task
const tasks: Record<string, any> = {};

app.get('/', (req, res) => res.send("AI Backend is Online"));

// Endpoint untuk memulai generate
app.post('/api/generate', upload.single('image'), async (req: any, res: any) => {
    const { prompt, aspectRatio } = req.body;
    const file = req.file;

    if (!file || !prompt) return res.status(400).json({ error: 'Data tidak lengkap' });

    const taskId = uuidv4();
    tasks[taskId] = { status: 'Antrian dimulai', progress: 0 };

    // Proses Background
    const service = new SupaworkService();
    service.generate(file.buffer, prompt, aspectRatio || '1:1', (msg, step) => {
        tasks[taskId] = { status: msg, progress: step * 12.5 };
    }).then(result => {
        tasks[taskId] = { status: 'Selesai', progress: 100, result: result.imageUrl };
    }).catch(err => {
        tasks[taskId] = { status: 'Error', progress: 0, error: err.message };
    });

    res.json({ taskId });
});

// Endpoint untuk cek status secara berkala
app.get('/api/status/:taskId', (req: any, res: any) => {
    const task = tasks[req.params.taskId];
    if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
    res.json(task);
});

// Export untuk Vercel
export default app;

// Jalankan lokal
if (process.env.NODE_ENV !== 'production') {
    export default app;
}