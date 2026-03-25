import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from '@atul-logistics/src/card';

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve:path.resolve(__dirname, 'src'),  
  alias:'@'
});