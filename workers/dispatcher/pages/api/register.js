import { registerWorker } from '@neardefi/shade-agent-js';

export default async function handler(req, res) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            res.status(200).json({ registered: true, development: true });
            return;
        }
        
        const result = await registerWorker();
        res.status(200).json(result);
    } catch (error) {
        console.log('Error registering worker:', error);
        res.status(500).json({ error: 'Failed to register worker: ' + error.message });
    }
}
