import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app'; // Importa getApps y getApp
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Importa solo la configuración de Firebase
import { firebaseConfig as localFirebaseConfig } from './firebase/firebaseConfig';

// Contexto para el estado de autenticación y la base de datos
const AppContext = createContext(null);

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
            onClick={onConfirm} // onConfirm acts as 'OK' for alerts
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

// Hook personalizado para el modal
const useModal = () => {
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


// Componente de Inicio de Sesión
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { auth, showAlert } = useContext(AppContext); // showAlert now comes from AppContext

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // La alerta de éxito y la redirección se manejarán en App.jsx's onAuthStateChanged
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      showAlert(`Error al iniciar sesión: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">Iniciar Sesión Admin</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password" // Agregado para accesibilidad
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Usa un correo y contraseña de administrador configurados en Firebase Auth.
        </p>
      </div>
    </div>
  );
};

// Componente de Dashboard (Vista General)
const Dashboard = () => {
  const { db } = useContext(AppContext);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db) return;

    const fetchSummary = async () => {
      try {
        // Productos
        const productsQuery = collection(db, 'productos');
        const productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
          const productsData = snapshot.docs.map(doc => doc.data());
          const lowStock = productsData.filter(p => p.cantidadInventario < 10).length; // Umbral de 10 para stock bajo
          setSummary(prev => ({
            ...prev,
            totalProducts: productsData.length,
            lowStockProducts: lowStock,
          }));
        }, (err) => {
          console.error("Error fetching products for dashboard:", err);
          setError("Error al cargar datos de productos.");
        });

        // Órdenes
        const ordersQuery = collection(db, 'orders'); // Colección 'orders' para coincidir con reglas
        const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map(doc => doc.data());
          const pending = ordersData.filter(o => o.estado === 'pendiente' || o.estado === 'procesando').length;
          setSummary(prev => ({
            ...prev,
            totalOrders: ordersData.length,
            pendingOrders: pending,
          }));
        }, (err) => {
          console.error("Error fetching orders for dashboard:", err);
          setError("Error al cargar datos de órdenes.");
        });

        setLoading(false);

        return () => {
          productsUnsubscribe();
          ordersUnsubscribe();
        };
      } catch (err) {
        console.error("Error general al obtener el resumen del dashboard:", err);
        setError("Error al cargar el resumen del dashboard.");
        setLoading(false);
      }
    };

    fetchSummary();
  }, [db]);

  if (loading) return <div className="text-center p-8">Cargando resumen...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Resumen del Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-blue-600 mb-2">{summary.totalProducts}</div>
          <p className="text-lg text-gray-700">Productos Totales</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-green-600 mb-2">{summary.totalOrders}</div>
          <p className="text-lg text-gray-700">Órdenes Totales</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-yellow-600 mb-2">{summary.pendingOrders}</div>
          <p className="text-lg text-gray-700">Órdenes Pendientes</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-red-600 mb-2">{summary.lowStockProducts}</div>
          <p className="text-lg text-gray-700">Productos con Poco Stock</p>
        </div>
      </div>
    </div>
  );
};

// Componente de Gestión de Productos
const Products = () => {
  const { db, storage } = useContext(AppContext);
  const { showAlert, showConfirm, closeModal, modalState } = useModal();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    cantidadInventario: '',
    categoria: '',
    imagen: null, // Para el archivo de imagen
    imagenUrl: '', // Para la URL de la imagen
  });

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'productos'), orderBy('fechaCreacion', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener productos:", err);
      setError("Error al cargar productos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const resetForm = () => {
    setNewProduct({
      nombre: '',
      descripcion: '',
      precio: '',
      cantidadInventario: '',
      categoria: '',
      imagen: null,
      imagenUrl: '',
    });
    setIsAdding(false);
    setIsEditing(false);
    setCurrentProduct(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setNewProduct({ ...newProduct, imagen: e.target.files[0] });
    }
  };

  const uploadImage = async (imageFile) => {
    if (!imageFile) return null;
    const storageRef = ref(storage, `product_images/${imageFile.name}_${Date.now()}`);
    await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(storageRef);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = '';
      if (newProduct.imagen) {
        imageUrl = await uploadImage(newProduct.imagen);
      }

      await addDoc(collection(db, 'productos'), {
        nombre: newProduct.nombre,
        descripcion: newProduct.descripcion,
        precio: parseFloat(newProduct.precio),
        cantidadInventario: parseInt(newProduct.cantidadInventario, 10),
        categoria: newProduct.categoria,
        imagenUrl: imageUrl,
        fechaCreacion: new Date(),
        ultimaActualizacion: new Date(),
        activo: true,
      });
      showAlert('Producto añadido con éxito.');
      resetForm();
    } catch (err) {
      console.error('Error añadiendo producto:', err);
      showAlert(`Error al añadir producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setNewProduct({
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: product.precio,
      cantidadInventario: product.cantidadInventario,
      categoria: product.categoria,
      imagen: null, // No precargamos el archivo, solo la URL
      imagenUrl: product.imagenUrl,
    });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = newProduct.imagenUrl;
      if (newProduct.imagen) {
        // Si se seleccionó una nueva imagen, subirla
        imageUrl = await uploadImage(newProduct.imagen);
      }

      const productRef = doc(db, 'productos', currentProduct.id);
      await updateDoc(productRef, {
        nombre: newProduct.nombre,
        descripcion: newProduct.descripcion,
        precio: parseFloat(newProduct.precio),
        cantidadInventario: parseInt(newProduct.cantidadInventario, 10),
        categoria: newProduct.categoria,
        imagenUrl: imageUrl,
        ultimaActualizacion: new Date(),
      });
      showAlert('Producto actualizado con éxito.');
      resetForm();
    } catch (err) {
      console.error('Error actualizando producto:', err);
      showAlert(`Error al actualizar producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (id) => {
    showConfirm(
      '¿Estás seguro de que quieres eliminar este producto?',
      async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, 'productos', id));
          showAlert('Producto eliminado con éxito.');
        } catch (err) {
          console.error('Error eliminando producto:', err);
          showAlert(`Error al eliminar producto: ${err.message}`);
        } finally {
          setLoading(false);
          closeModal();
        }
      },
      closeModal
    );
  };

  if (loading) return <div className="text-center p-8">Cargando productos...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Gestión de Productos</h1>

      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <button
          onClick={() => { setIsAdding(true); /* Eliminado: resetForm(); */ }}
          className="bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors shadow-md mb-6"
        >
          Añadir Nuevo Producto
        </button>

        {(isAdding || isEditing) && (
          <form onSubmit={isEditing ? handleUpdateProduct : handleAddProduct} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}
            </h2>
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
              <input type="text" id="nombre" name="nombre" value={newProduct.nombre} onChange={handleInputChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea id="descripcion" name="descripcion" value={newProduct.descripcion} onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="precio" className="block text-sm font-medium text-gray-700">Precio</label>
                <input type="number" id="precio" name="precio" value={newProduct.precio} onChange={handleInputChange} required step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="cantidadInventario" className="block text-sm font-medium text-gray-700">Cantidad en Inventario</label>
                <input type="number" id="cantidadInventario" name="cantidadInventario" value={newProduct.cantidadInventario} onChange={handleInputChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">Categoría</label>
              <input type="text" id="categoria" name="categoria" value={newProduct.categoria} onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="imagen" className="block text-sm font-medium text-gray-700">Imagen del Producto</label>
              <input type="file" id="imagen" name="imagen" onChange={handleImageChange}
                className="w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              {newProduct.imagenUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Imagen actual:</p>
                  <img src={newProduct.imagenUrl} alt="Producto" className="w-24 h-24 object-cover rounded-md mt-1 shadow" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-300 text-gray-800 rounded-md font-semibold hover:bg-gray-400 transition-colors shadow-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                disabled={loading}
              >
                {isEditing ? 'Actualizar Producto' : 'Añadir Producto'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Lista de Productos</h2>
        {products.length === 0 ? (
          <p className="text-gray-600">No hay productos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.imagenUrl ? (
                        <img src={product.imagenUrl} alt={product.nombre} className="w-16 h-16 object-cover rounded-md shadow" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">
                          Sin imagen
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.precio.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.cantidadInventario}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.categoria || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};

// Componente de Gestión de Órdenes (AHORA CON LAS CORRECCIONES)
const Orders = () => {
  const { db } = useContext(AppContext);
  const { showAlert, showConfirm, closeModal, modalState } = useModal();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orderStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];

  useEffect(() => {
    console.log("Orders.jsx: useEffect se ejecutó.");
    if (!db) {
      console.log("Orders.jsx: db no está disponible.");
      setError("La base de datos no está inicializada.");
      setLoading(false);
      return;
    }

    console.log("Orders.jsx: Intentando obtener órdenes de Firestore...");
    // Colección 'orders' para coincidir con las reglas de seguridad
    const q = query(collection(db, 'orders'), orderBy('fechaOrden', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        let estado = data.estado;

        // Si estado es un objeto, intenta encontrar una cadena de estado válida
        if (typeof estado === 'object' && estado !== null) {
          console.warn(`Orders.jsx: 'estado' para la orden ${doc.id} es un objeto. Intentando analizar o establecer un valor predeterminado.`);
          const foundStatusKey = orderStatuses.find(statusKey => Object.keys(estado).includes(statusKey));
          if (foundStatusKey) {
            estado = foundStatusKey; // Usa la primera clave de estado válida encontrada
            console.log(`Orders.jsx: 'estado' analizado de objeto a cadena: ${estado}`);
          } else {
            estado = 'desconocido'; // Valor predeterminado si no se encuentra una clave de estado válida
            console.warn(`Orders.jsx: No se encontró una clave de estado válida en el objeto para la orden ${doc.id}. Se establece 'desconocido'.`);
          }
        } else if (typeof estado !== 'string') {
          // Si no es una cadena y no es un objeto, establece un valor predeterminado.
          console.warn(`Orders.jsx: 'estado' para la orden ${doc.id} no es una cadena ni un objeto. Tipo: ${typeof estado}. Se establece 'desconocido'.`);
          estado = 'desconocido';
        }

        return { id: doc.id, ...data, estado: estado };
      });
      console.log("Orders.jsx: Datos de órdenes recibidos y procesados:", ordersData);
      setOrders(ordersData);
      setLoading(false);
    }, (err) => {
      console.error("Orders.jsx: Error al obtener órdenes:", err);
      setError("Error al cargar órdenes: " + err.message);
      setLoading(false);
    });

    return () => {
      console.log("Orders.jsx: Limpiando suscripción de onSnapshot.");
      unsubscribe();
    };
  }, [db]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setLoading(true);
    console.log(`Intentando actualizar la orden ${orderId} a estado: ${newStatus}`); // Log para depuración
    try {
      const orderRef = doc(db, 'orders', orderId); // Colección 'orders'
      await updateDoc(orderRef, { estado: newStatus });
      showAlert('Estado de la orden actualizado con éxito.');
      console.log(`Orden ${orderId} actualizada a estado: ${newStatus}`); // Log de éxito
    } catch (err) {
      console.error('Error actualizando estado de la orden:', err);
      showAlert(`Error al actualizar estado: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-8">Cargando órdenes...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Gestión de Órdenes</h1>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Lista de Órdenes</h2>
        {orders.length === 0 ? (
          <p className="text-gray-600">No hay órdenes registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Orden</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    {/* CAMBIO 1: Mostrar el ID de la orden completo */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.fechaOrden && typeof order.fechaOrden.toDate === 'function'
                        ? order.fechaOrden.toDate().toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {typeof order.total === 'number' && !isNaN(order.total)
                        ? `$${order.total.toFixed(2)}`
                        : '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${order.estado === 'entregado' ? 'bg-green-100 text-green-800' :
                           order.estado === 'cancelado' ? 'bg-red-100 text-red-800' :
                           'bg-yellow-100 text-yellow-800'}`}>
                        {typeof order.estado === 'string' ? order.estado : 'Estado Inválido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <ul className="list-disc list-inside">
                        {/* CAMBIO 2: Usar order.items y las propiedades name y quantity */}
                        {order.items && order.items.map((item, index) => (
                          <li key={index}>{item.name} (x{item.quantity})</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <select
                        value={typeof order.estado === 'string' ? order.estado : ''}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
                      >
                        {orderStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};


// Componente principal de la aplicación
export default function App() {
  // Los estados de firebaseApp, db, auth, storage ahora se inicializan una sola vez fuera del componente
  // y se acceden directamente o se pasan a través del contexto.
  const { modalState, showAlert } = useModal();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [hasShownAdminLoginAlert, setHasShownAdminLoginAlert] = useState(false);

  // Mueve la inicialización de Firebase fuera del componente para que ocurra solo una vez
  // al cargar el módulo.
  const firebaseInitResult = React.useMemo(() => {
    try {
      console.log("App.jsx: Iniciando inicialización de Firebase...");
      console.log("App.jsx: Valor de __app_id (global):", typeof __app_id !== 'undefined' ? __app_id : 'NO DEFINIDO');
      console.log("App.jsx: Valor de __firebase_config (global):", typeof __firebase_config !== 'undefined' ? __firebase_config : 'NO DEFINIDO');
      console.log("App.jsx: Valor de localFirebaseConfig (importado):", localFirebaseConfig);

      let finalFirebaseConfig = {};
      // Prioriza la configuración global si está disponible y no está vacía
      if (typeof __firebase_config !== 'undefined' && __firebase_config && Object.keys(JSON.parse(__firebase_config)).length > 0) {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("App.jsx: Usando configuración de Firebase de __firebase_config (global).");
      } else if (Object.keys(localFirebaseConfig).length > 0) {
        finalFirebaseConfig = localFirebaseConfig;
        console.log("App.jsx: Usando configuración de Firebase de localFirebaseConfig (archivo).");
      } else {
        throw new Error("La configuración de Firebase no está disponible. Por favor, proporciónala.");
      }

      console.log("App.jsx: Configuración de Firebase final a usar:", finalFirebaseConfig);

      // Verifica si ya hay una app de Firebase inicializada
      const app = getApps().length === 0 ? initializeApp(finalFirebaseConfig) : getApp();
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      const storageInstance = getStorage(app);
      console.log("App.jsx: Firebase inicializado con éxito.");
      return { app, auth: authInstance, db: dbInstance, storage: storageInstance, error: null };
    } catch (e) {
      console.error("App.jsx: Error al inicializar Firebase:", e);
      // No se puede usar showAlert aquí directamente porque el hook useModal
      // no está disponible en este ámbito (fuera del componente).
      // Se manejará el error en el renderizado condicional del componente App.
      return { app: null, auth: null, db: null, storage: null, error: e.message };
    }
  }, []); // El array de dependencias vacío asegura que esto se ejecute solo una vez

  // Extrae las instancias de Firebase del resultado de useMemo
  const { app: firebaseApp, auth, db, storage, error: firebaseInitError } = firebaseInitResult;

  // Handle authentication state changes and role verification
  useEffect(() => {
    // Solo procede si auth y db están inicializados y no hay errores de inicialización
    if (!auth || !db || firebaseInitError) {
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      console.log("App.jsx: onAuthStateChanged - Usuario actual:", user ? user.email : "Ninguno");

      if (user) {
        try {
          console.log(`App.jsx: Verificando rol para UID: ${user.uid}`);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists() && userDoc.data().role === 'admin') {
            console.log("App.jsx: Usuario es administrador.");
            setIsAdmin(true);
            if (!hasShownAdminLoginAlert) {
              showAlert(`¡Inicio de sesión exitoso como Administrador!`);
              setHasShownAdminLoginAlert(true);
            }
          } else {
            console.log("App.jsx: Usuario NO es administrador o rol no definido. Documento existe:", userDoc.exists(), "Rol:", userDoc.data()?.role);
            setIsAdmin(false);
            setCurrentUser(null); // Limpia el usuario para forzar el login
            showAlert('Acceso denegado: No tienes permisos de administrador.', 'error');
            await signOut(auth);
            console.log("App.jsx: Sesión de usuario no-admin cerrada.");
            setHasShownAdminLoginAlert(false);
          }
        } catch (error) {
          console.error("App.jsx: Error al obtener el rol del usuario:", error);
          setIsAdmin(false);
          setCurrentUser(null);
          showAlert('Error al verificar permisos. Por favor, intenta iniciar sesión de nuevo.', 'error');
          await signOut(auth);
          console.log("App.jsx: Sesión cerrada debido a error en verificación de rol.");
          setHasShownAdminLoginAlert(false);
        }

        // Si se proporciona un token inicial (del Canvas), inicia sesión con él
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            // Solo intenta signInWithCustomToken si no es el mismo usuario ya logueado
            if (!user || user.uid !== auth.currentUser?.uid) {
              await signInWithCustomToken(auth, __initial_auth_token);
              console.log("App.jsx: Sesión iniciada con token personalizado (posiblemente para Canvas).");
            }
          } catch (error) {
            console.error("App.jsx: Error al iniciar sesión con token personalizado:", error);
            showAlert(`Error al iniciar sesión con token personalizado: ${error.message}`);
          }
        }
      } else {
        console.log("App.jsx: No hay usuario logueado.");
        setIsAdmin(false);
        setCurrentUser(null);
        setCurrentPage('dashboard'); // Por defecto al dashboard (que mostrará el login)
        setHasShownAdminLoginAlert(false);
      }
      setLoadingAuth(false);
      console.log(`App.jsx: Fin de onAuthStateChanged. currentUser: ${user ? user.email : 'null'}, isAdmin: ${isAdmin}`);
    });

    return () => unsubscribe();
  }, [auth, db, showAlert, hasShownAdminLoginAlert]); // Dependencias: auth, db, showAlert, hasShownAdminLoginAlert

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        showAlert('¡Sesión cerrada con éxito!');
        setCurrentPage('dashboard');
        setHasShownAdminLoginAlert(false);
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showAlert(`Error al cerrar sesión: ${error.message}`);
      }
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Cargando autenticación...</div>
      </div>
    );
  }

  // Si hay un error de inicialización de Firebase, mostrarlo
  if (firebaseInitError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4">
        <p className="text-lg text-center">
          Error: No se pudo inicializar Firebase. {firebaseInitError}. Por favor, verifica la configuración.
        </p>
        <CustomModal {...modalState} />
      </div>
    );
  }

  // Si Firebase no está completamente inicializado (aunque el error ya se maneja arriba)
  if (!firebaseApp || !db || !auth || !storage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4">
        <p className="text-lg text-center">
          Error: Componentes de Firebase no disponibles.
        </p>
        <CustomModal {...modalState} />
      </div>
    );
  }

  // CRÍTICO: Renderizado condicional para el Acceso al Panel de Administración
  // Solo renderiza el panel de administración si hay un usuario logueado Y es un administrador.
  // Si no se cumplen estas condiciones, se muestra el componente de Login.
  if (!currentUser || !isAdmin) {
    console.log("App.jsx: Mostrando Login. currentUser:", currentUser ? currentUser.email : "null", "isAdmin:", isAdmin);
    return (
      <AppContext.Provider value={{ db, auth, storage, currentUser, showAlert }}>
        <Login />
        <CustomModal {...modalState} />
      </AppContext.Provider>
    );
  }

  // Diseño principal del Dashboard (solo se renderiza para administradores autenticados)
  console.log("App.jsx: Mostrando Panel de Administrador. currentUser:", currentUser.email, "isAdmin:", isAdmin);
  return (
    <AppContext.Provider value={{ db, auth, storage, currentUser, showAlert }}>
      <div className="flex flex-col min-h-screen bg-gray-100 font-inter">
        {/* Navbar */}
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
            {currentPage === 'dashboard' && <Dashboard />}
            {currentPage === 'products' && <Products />}
            {currentPage === 'orders' && <Orders />}
          </main>
        </div>
      </div>
      <CustomModal {...modalState} />
    </AppContext.Provider>
  );
}
