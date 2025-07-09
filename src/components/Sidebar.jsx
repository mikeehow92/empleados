import React from 'react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  return (
    <aside className="w-64 bg-blue-800 text-white p-6 shadow-xl">
      <nav className="space-y-4">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'dashboard' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setCurrentPage('products')}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'products' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setCurrentPage('orders')}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'orders' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}
        >
          Órdenes
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar; 