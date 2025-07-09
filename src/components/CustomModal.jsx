import React from 'react';

// Componente Modal personalizado para alertas y confirmaciones
const CustomModal = ({ message, onConfirm, onCancel, type }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
        <p className="text-lg font-semibold mb-4">{message}</p>
        {type === 'confirm' ? (
          <div className="flex justify-around gap-4">
            <button
              onClick={onConfirm}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
            >
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors shadow-md"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onConfirm} // onConfirm actúa como 'OK' para alertas
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomModal; 