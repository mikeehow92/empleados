import React, { useState, useEffect, createContext } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Importa los componentes de tu aplicación
import Products from './Products'; // Asegúrate de que la ruta sea correcta
// import Dashboard from './Dashboard'; // Si lo tienes
// import Orders from './Orders'; // Si lo tienes

// Importa solo la configuración de Firebase
import { firebaseConfig as localFirebaseConfig } from './firebase/firebaseConfig';

// Contexto para el estado de autenticación y la base de datos
export const AppContext = createContext(null);

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
            onClick={onConfirm}
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

// Componente principal de la aplicación
const App = () => {
  const [firebaseApp, setFirebaseApp] = useState(null);
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPage, setCurrentPage] = useState('products');

  // Estado y funciones del modal
  const [modalState, setModalState] = useState({
    message: null,
    onConfirm: () => {},
    onCancel: () => {},
    type: 'alert',
  });

  const showAlert = (message) => {
    setModalState({ message, onConfirm: () => closeModal(), type: 'alert' });
  };

  const showConfirm = (message, onConfirm) => {
    setModalState({ message, onConfirm, onCancel: () => closeModal(), type: 'confirm' });
  };

  const closeModal = () => {
    setModalState({ message: null, onConfirm: () => {}, onCancel: () => {}, type: 'alert' });
  };

  // Inicialización de Firebase
  useEffect(() => {
    if (!getApps().length) {
      setFirebaseApp(initializeApp(localFirebaseConfig));
    } else {
      setFirebaseApp(getApp());
    }
  }, []);

  // Inicialización de los servicios de Firebase y gestión del estado del usuario
  useEffect(() => {
    if (firebaseApp) {
      const authInstance = getAuth(firebaseApp);
      setAuth(authInstance);
      setDb(getFirestore(firebaseApp));
      setStorage(getStorage(firebaseApp));

      // Observa el estado de autenticación y verifica el rol de administrador
      const unsubscribe = onAuthStateChanged(authInstance, async (authUser) => {
        setUser(authUser);
        if (authUser) {
          try {
            // Fuerza la actualización del token para obtener los últimos claims
            // Esto es crucial para que las reglas de seguridad de Storage funcionen
            const idTokenResult = await authUser.getIdTokenResult(true);
            setIsAdmin(!!idTokenResult.claims.admin);
            console.log("Token de usuario actualizado. isAdmin:", !!idTokenResult.claims.admin);
          } catch (error) {
            console.error("Error al obtener el token de ID:", error);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      });
      return () => unsubscribe();
    }
  }, [firebaseApp]);

  // Manejador del login
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // No necesitamos manejar el éxito aquí; onAuthStateChanged lo hará
    } catch (error) {
      showAlert(`Error de inicio de sesión: ${error.message}`);
    }
  };

  // Manejador del logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Si el usuario no ha iniciado sesión, muestra el formulario de login
  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sesión de Administrador</h2>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition-colors"
            >
              Entrar
            </button>
          </div>
        </form>
        <CustomModal {...modalState} />
      </div>
    );
  }

  // Si el usuario es administrador, muestra la interfaz de la aplicación
  return (
    <AppContext.Provider value={{ db, storage, auth, user, showAlert, showConfirm, closeModal, modalState }}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Navbar */}
        <nav className="bg-white shadow-md p-4 flex justify-between items-center z-10">
          <h1 className="text-2xl font-bold text-blue-800">Panel de Administración</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Bienvenido, {user.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-md"
            >
              Cerrar Sesión
            </button>
          </div>
        </nav>

        <div className="flex flex-1">
          {/* Sidebar */}
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

          {/* Main Content */}
          <main className="flex-1 p-6">
            {/* Renderiza el componente de la página actual */}
            {currentPage === 'dashboard' && <p>Dashboard</p>}
            {currentPage === 'products' && <Products />}
            {currentPage === 'orders' && <p>Órdenes</p>}
          </main>
        </div>
      </div>
      <CustomModal {...modalState} />
    </AppContext.Provider>
  );
};

export default App;
