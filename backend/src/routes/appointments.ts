import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// IMPORTANTE: rotas específicas ANTES das com parâmetros genéricos

// Públicas — slots disponíveis podem ser consultados sem login
router.get('/slots/available', appointmentController.getAvailableSlots);

// Privadas — cada listagem só para o dono (paciente, clínica ou profissional)
router.get('/patient/:codigo_paciente',           authenticate, appointmentController.getAppointmentsByPatient);
router.get('/clinic/:codigo_clinica',             authenticate, appointmentController.getAppointmentsByClinic);
router.get('/professional/:codigo_profissional',  authenticate, appointmentController.getAppointmentsByProfessional);
router.get('/:codigo/notes',                      authenticate, appointmentController.getNotes);
router.get('/:codigo',                            authenticate, appointmentController.getAppointmentById);

// Privadas — escrita sempre exige token
router.post('/',                authenticate, appointmentController.createAppointment);
router.post('/:codigo/notes',   authenticate, appointmentController.addNote);
router.patch('/:codigo/confirm', authenticate, appointmentController.transition('confirmar'));
router.patch('/:codigo/start',   authenticate, appointmentController.transition('iniciar'));
router.patch('/:codigo/finish',  authenticate, appointmentController.transition('finalizar'));
router.patch('/:codigo/no-show', authenticate, appointmentController.transition('faltou'));
router.patch('/:codigo/cancel',  authenticate, appointmentController.transition('cancelar'));
router.patch('/:codigo/status', authenticate, appointmentController.updateAppointmentStatus);
router.put('/:codigo',        authenticate, appointmentController.updateAppointment);
router.delete('/:codigo',     authenticate, appointmentController.deleteAppointment);

export default router;
