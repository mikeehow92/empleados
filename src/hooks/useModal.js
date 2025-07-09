import { useState } from 'react';

// Hook personalizado para el modal
export const useModal = () => {
  const [modalState, setModalState] = useState({
    message: '',
    onConfirm: null,
    onCancel: null,
    type: 'alert', // 'alert' or 'confirm'
  });

  const showAlert = (message, onConfirm = () => setModalState({ message: '' })) => {
    setModalState({ message, onConfirm, onCancel: null, type: 'alert' });
  };

  const showConfirm = (message, onConfirm, onCancel = () => setModalState({ message: '' })) => {
    setModalState({ message, onConfirm, onCancel, type: 'confirm' });
  };

  const closeModal = () => setModalState({ message: '' });

  return { modalState, showAlert, showConfirm, closeModal };
};
