// routes/pathRoutes.js
// Định nghĩa routes liên quan đến Roads, Road Nodes và tìm đường A*

import { Router } from 'express';
import { RoadController, RoadNodeController } from '../controllers/RoadController.js';

const router = Router();

// ── Road Nodes: /api/road-nodes ──────────────────────────────────────────────
router.get('/nodes',        RoadNodeController.getAll);    // ?near=lng,lat
router.get('/nodes/:id',    RoadNodeController.getById);
router.post('/nodes',       RoadNodeController.create);
router.put('/nodes/:id',    RoadNodeController.update);
router.delete('/nodes/:id', RoadNodeController.delete);

// ── Tìm đường A*: /api/paths/find?from=1&to=5 ───────────────────────────────
router.get('/find', RoadController.findPath);

// ── Roads: /api/paths ────────────────────────────────────────────────────────
router.get('/',     RoadController.getAll);      // ?geojson=true → GeoJSON
router.get('/:id',  RoadController.getById);
router.post('/',    RoadController.create);
router.put('/:id',  RoadController.update);
router.delete('/:id', RoadController.delete);

export default router;
