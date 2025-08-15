import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Importa los componentes de la aplicación
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Products from './Products.jsx';
import Orders from './Orders.jsx';
import CustomModal from './components/CustomModal.jsx';
import { useModal } from './hooks/useModal.js';

// Contexto para el estado de autenticación y la base de datos
const AppContext = createContext(null);

// Importa solo la configuración de Firebase
const firebaseConfig = {
  // Aquí debería ir tu configuración de Firebase
};

// Componente principal de la aplicación
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [storage, setStorage] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { showAlert, showConfirm, closeModal, modalState } = useModal();

  useEffect(() => {
    // Configuración de Firebase
    let app;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    const firestoreDb = getFirestore(app);
    const authInstance = getAuth(app);
    const storageInstance = getStorage(app);

    setDb(firestoreDb);
    setAuth(authInstance);
    setStorage(storageInstance);

    // Manejo de la autenticación
    const unsubscribe = onAuthStateChanged(authInstance, async (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    showConfirm('¿Estás seguro de que quieres cerrar sesión?', async () => {
      try {
        await signOut(auth);
        showAlert('Cierre de sesión exitoso');
        closeModal();
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showAlert('Error al cerrar sesión');
        closeModal();
      }
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }

    if (!user) {
      return <Login />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'orders':
        return <Orders />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={{ db, auth, storage, user, showAlert }}>
      {user ? (
        <div className="min-h-screen flex flex-col bg-gray-100 font-sans antialiased">
          {/* Barra de navegación superior */}
          <nav className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center">
              <span className="text-2xl font-bold">Admin Panel</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">{user.email}</span>
              <button
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </nav>

          <div className="flex flex-1">
            {/* Barra lateral */}
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

            {/* Contenido principal */}
            <main className="flex-1 p-6">
              {renderContent()}
            </main>
          </div>
        </div>
      ) : (
        <Login />
      )}
      <CustomModal {...modalState} />
    </AppContext.Provider>
  );
};

export default App;

export { AppContext };
