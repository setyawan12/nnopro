import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { SupaworkService } from '../src/services/SupaworkService.js'; // Pakai .js karena mode ESM

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const tasks: Record<string, any> = {};

app.get('/', (req, res) => res.json({ status: "AI Backend Online", mode: "ESM" }));

app.post('/api/generate', upload.single('image'), async (req: any, res: any) => {
    const { prompt, aspectRatio } = req.body;
    const file = req.file;

    if (!file || !prompt) return res.status(400).json({ error: 'Missing prompt or file' });

    const taskId = uuidv4();
    tasks[taskId] = { status: 'Antrian Dimulai', progress: 0 };

    // Jalankan service
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

app.get('/api/status/:taskId', (req: any, res: any) => {
    const task = tasks[req.params.taskId];
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

export default app;