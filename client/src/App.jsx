import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-blue-500">
          Lockout Arena ⚔️
        </h1>
        <p className="text-gray-400">
          Real-time 1v1 Competitive Programming Lockout Duels with Verification & Rating Engine.
        </p>
        <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium">
          Frontend & Environment initialized successfully
        </div>
      </div>
    </div>
  );
}

export default App;