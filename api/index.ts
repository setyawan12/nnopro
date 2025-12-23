import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { SupaworkService } from '../src/services/SupaworkService';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// In-memory task store
const tasks: Record<string, any> = {};

app.get('/', (req: Request, res: Response) => {
    res.json({ status: "Online", engine: "CommonJS", repo: "nnopro" });
});

app.post('/api/generate', upload.single('image'), async (req: any, res: any) => {
    const { prompt, aspectRatio } = req.body;
    const file = req.file;

    if (!file || !prompt) return res.status(400).json({ error: 'Data gambar atau prompt hilang.' });

    const taskId = uuidv4();
    tasks[taskId] = { status: 'Diproses', progress: 0 };

    // Background Process
    const service = new SupaworkService();
    service.generate(file.buffer, prompt, aspectRatio || '1:1', (msg: string, step: number) => {
        tasks[taskId] = { status: msg, progress: step * 12.5 };
    }).then((result: any) => {
        tasks[taskId] = { status: 'Selesai', progress: 100, result: result.imageUrl };
    }).catch((err: any) => {
        tasks[taskId] = { status: 'Gagal', progress: 0, error: err.message };
    });

    res.json({ taskId });
});

app.get('/api/status/:taskId', (req: Request, res: Response) => {
    const task = tasks[req.params.taskId];
    if (!task) return res.status(404).json({ error: 'Task tidak ditemukan.' });
    res.json(task);
});

module.exports = app;