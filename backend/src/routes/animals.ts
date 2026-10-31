import { Router } from 'express';
import * as animalController from '../controllers/animalController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Todas privadas: o tutor vê e edita os próprios animais; a clínica ou o
// veterinário que atendeu o animal vê o cadastro, as vacinas e o histórico.
router.get('/',               authenticate, animalController.listAnimals);
router.get('/:id/vaccines',   authenticate, animalController.listVaccines);
router.get('/:id/history',    authenticate, animalController.getHistory);
router.get('/:id',            authenticate, animalController.getAnimal);
router.post('/',              authenticate, animalController.createAnimal);
router.post('/:id/vaccines',  authenticate, animalController.addVaccine);
router.put('/:id',            authenticate, animalController.updateAnimal);
router.delete('/:id',         authenticate, animalController.deleteAnimal);

export default router;
