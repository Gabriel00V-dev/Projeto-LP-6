import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { supabase, missingEnvVars } from './supabaseClient';

import patientsRouter       from './routes/patients';
import clinicsRouter        from './routes/clinics';
import specsRouter          from './routes/specializations';
import authRouter           from './routes/auth';
import appointmentsRouter   from './routes/appointments';
import documentsRouter      from './routes/documents';
import addonsRouter         from './routes/addons';       // novo

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Clinica API (TypeScript) - ok',
    supabase: missingEnvVars.length === 0 ? 'configurado' : 'sem configuração',
  });
});

// Sem as credenciais do Supabase nada funciona. Responder aqui, com a lista do
// que falta, evita um 500 sem explicação em cada rota.
app.use((_req: Request, res: Response, next) => {
  if (missingEnvVars.length > 0) {
    return res.status(503).json({
      error: `Configuração ausente no servidor: ${missingEnvVars.join(', ')}`,
    });
  }
  next();
});

// Upload de imagens para o Supabase Storage
app.post('/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File & { buffer?: Buffer };
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const bucket = 'uploads';
    const timestamp = Date.now();
    const filename = `${file.fieldname}-${timestamp}${path.extname(file.originalname)}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) {
      return res.status(500).json({ error: error.message || 'Storage upload failed' });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filename);
    return res.json({ imageUrl: publicUrlData?.publicUrl ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Rotas
app.use('/patients',      patientsRouter);
app.use('/clinics',       clinicsRouter);
app.use('/specializations', specsRouter);
app.use('/auth',          authRouter);
app.use('/appointments',  appointmentsRouter);
app.use('/documents',     documentsRouter);
app.use('/addons',        addonsRouter);        // novo

// Em ambiente serverless (Vercel) o app é exportado e invocado por request,
// sem precisar escutar uma porta.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;