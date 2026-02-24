const localtunnel = require('localtunnel');

(async () => {
  console.log('Starting tunnels...');

  // Backend Tunnel (Port 5000)
  const backendTunnel = await localtunnel({ port: 5000 });
  console.log('✅ Backend URL:', backendTunnel.url);

  // Frontend Tunnel (Port 5173)
  const frontendTunnel = await localtunnel({ port: 5173 });
  console.log('✅ Frontend URL:', frontendTunnel.url);

  console.log('\nIMPORTANT:');
  console.log('1. Copy the Backend URL.');
  console.log('2. Update your frontend/.env file VITE_API_URL with this URL.');
  console.log('3. Open the Frontend URL on your mobile.');
  
  backendTunnel.on('close', () => {
    console.log('Backend tunnel closed');
  });

  frontendTunnel.on('close', () => {
    console.log('Frontend tunnel closed');
  });
})();
