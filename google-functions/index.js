/**
 * TalentoSaaS — Função 3: Recomendador de Trilha de Capacitação
 * Runtime: Google Cloud Run functions (Node.js 22), gatilho HTTP,
 * invocações não autenticadas permitidas. Entry point: recomendarTrilha
 */
import functions from '@google-cloud/functions-framework';
import { recomendarTrilha } from './src/handler.mjs';

functions.http('recomendarTrilha', recomendarTrilha);
