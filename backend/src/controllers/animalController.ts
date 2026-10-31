import { Request, Response } from 'express';
import * as animalService from '../services/animalService';
import { responderErro } from '../utils/httpError';

export async function listAnimals(req: Request, res: Response) {
  try {
    res.json(await animalService.listarAnimais(req.user!));
  } catch (error) {
    responderErro(res, error, 'listAnimals');
  }
}

export async function getAnimal(req: Request, res: Response) {
  try {
    res.json(await animalService.obterAnimal(req.user!, Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'getAnimal');
  }
}

export async function createAnimal(req: Request, res: Response) {
  try {
    res.status(201).json(await animalService.criarAnimal(req.user!, req.body));
  } catch (error) {
    responderErro(res, error, 'createAnimal');
  }
}

export async function updateAnimal(req: Request, res: Response) {
  try {
    res.json(await animalService.atualizarAnimal(req.user!, Number(req.params.id), req.body));
  } catch (error) {
    responderErro(res, error, 'updateAnimal');
  }
}

export async function deleteAnimal(req: Request, res: Response) {
  try {
    res.json(await animalService.removerAnimal(req.user!, Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'deleteAnimal');
  }
}

export async function listVaccines(req: Request, res: Response) {
  try {
    res.json(await animalService.listarVacinas(req.user!, Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'listVaccines');
  }
}

export async function addVaccine(req: Request, res: Response) {
  try {
    res.status(201).json(await animalService.registrarVacina(req.user!, Number(req.params.id), req.body));
  } catch (error) {
    responderErro(res, error, 'addVaccine');
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    res.json(await animalService.historicoClinico(req.user!, Number(req.params.id)));
  } catch (error) {
    responderErro(res, error, 'getHistory');
  }
}
