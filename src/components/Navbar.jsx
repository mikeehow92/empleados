import React from 'react';

const Navbar = ({ handleLogout, currentUser }) => {
  return (
    <nav className="bg-blue-700 p-4 text-white shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Panel de Administrador</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm">
            Usuario: {currentUser.email || currentUser.uid}
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors shadow-md"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 
