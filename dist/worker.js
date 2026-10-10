import {runSimulation} from './simulation.js';
self.onmessage=e=>{try{const data=runSimulation(e.data,progress=>self.postMessage({progress}));self.postMessage({data});}catch(error){self.postMessage({error:error.message});}};
