import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  const { auth, showAlert } = useContext(AppContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
              autoComplete="current-password"
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
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  useEffect(() => {
    if (!db) return;

    const fetchSummary = async () => {
      try {
        // Productos
        const productsQuery = collection(db, `artifacts/${appId}/public/data/productos`);
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
        const ordersQuery = collection(db, `artifacts/${appId}/public/data/orders`);
        const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map(doc => doc.data());
          const pending = ordersData.filter(o => o.paymentStatus === 'PENDIENTE').length;
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
  }, [db, appId]);

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
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const userId = useContext(AppContext).userId;

  useEffect(() => {
    if (!db || !userId) return;

    const q = query(collection(db, `artifacts/${appId}/users/${userId}/products`), orderBy('fechaCreacion', 'desc'));
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
  }, [db, userId, appId]);

  const resetForm = () => {
    setNewProduct({
      nombre: '',
      descripcion: '',
      precio: '',
      cantidadInventario: '',
      categoria: '',
      imagen: null, // Para el archivo de imagen
      imagenUrl: '', // Para la URL de la imagen
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
    if (!imageFile || !storage) return null;
    const storageRef = ref(storage, `product_images/${imageFile.name}_${Date.now()}`);
    await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(storageRef);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!userId) {
        showAlert('Error de autenticación. Por favor, recarga la página.');
        setLoading(false);
        return;
    }

    try {
      let imageUrl = '';
      if (newProduct.imagen) {
        imageUrl = await uploadImage(newProduct.imagen);
      }
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/products`), {
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
      imagen: null,
      imagenUrl: product.imagenUrl,
    });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!currentProduct || !userId) {
        showAlert('Error: No se puede actualizar el producto.');
        setLoading(false);
        return;
    }

    try {
      let imageUrl = newProduct.imagenUrl;
      if (newProduct.imagen) {
        imageUrl = await uploadImage(newProduct.imagen);
      }
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, currentProduct.id), {
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

  const handleDeleteProduct = (product) => {
    showConfirm(
      `¿Estás seguro de que quieres eliminar el producto "${product.nombre}"?`,
      async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, product.id));
          showAlert('Producto eliminado con éxito.');
        } catch (err) {
          console.error('Error eliminando producto:', err);
          showAlert(`Error al eliminar producto: ${err.message}`);
        } finally {
          setLoading(false);
          closeModal();
        }
      }
    );
  };

  if (loading) return <div className="text-center p-8">Cargando productos...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Gestión de Productos</h1>
        <button
          onClick={() => { setIsAdding(true); resetForm(); }}
          className="bg-blue-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-lg"
        >
          Añadir Producto
        </button>
      </div>

      {(isAdding || isEditing) && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h2>
          <form onSubmit={isEditing ? handleUpdateProduct : handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="nombre"
                value={newProduct.nombre}
                onChange={handleInputChange}
                placeholder="Nombre del Producto"
                className="p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                name="descripcion"
                value={newProduct.descripcion}
                onChange={handleInputChange}
                placeholder="Descripción"
                className="p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="number"
                name="precio"
                value={newProduct.precio}
                onChange={handleInputChange}
                placeholder="Precio"
                className="p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                required
              />
              <input
                type="number"
                name="cantidadInventario"
                value={newProduct.cantidadInventario}
                onChange={handleInputChange}
                placeholder="Cantidad en Inventario"
                className="p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                name="categoria"
                value={newProduct.categoria}
                onChange={handleInputChange}
                placeholder="Categoría"
                className="p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  onChange={handleImageChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {newProduct.imagenUrl && (
                  <img src={newProduct.imagenUrl} alt="Vista previa" className="w-16 h-16 object-cover rounded-md shadow"/>
                )}
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
                disabled={loading}
              >
                {isEditing ? 'Guardar Cambios' : 'Añadir Producto'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-800 py-3 px-6 rounded-md font-semibold hover:bg-gray-400 transition-colors shadow-lg"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Lista de Productos</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Imagen</th>
                <th className="py-3 px-6 text-left">Nombre</th>
                <th className="py-3 px-6 text-left">Precio</th>
                <th className="py-3 px-6 text-left">Stock</th>
                <th className="py-3 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {products.map(product => (
                <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-6 text-left whitespace-nowrap">
                    <img src={product.imagenUrl || 'https://placehold.co/40x40'} alt={product.nombre} className="w-10 h-10 rounded-full object-cover"/>
                  </td>
                  <td className="py-3 px-6 text-left">{product.nombre}</td>
                  <td className="py-3 px-6 text-left">${product.precio.toFixed(2)}</td>
                  <td className="py-3 px-6 text-left">{product.cantidadInventario}</td>
                  <td className="py-3 px-6 text-center">
                    <div className="flex item-center justify-center">
                      <button onClick={() => handleEditProduct(product)} className="w-8 h-8 mr-2 transform hover:text-blue-500 hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteProduct(product)} className="w-8 h-8 ml-2 transform hover:text-red-500 hover:scale-110">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// Componente de Órdenes
const Orders = () => {
    const { db, isAuthReady } = useContext(AppContext);
    const { showAlert, showConfirm, closeModal } = useModal();
    const [orders, setOrders] = useState([]);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    useEffect(() => {
        if (!db || !isAuthReady) return;

        const q = collection(db, `artifacts/${appId}/public/data/orders`);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Ordenar por fecha de creación de forma descendente
            ordersList.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
            setOrders(ordersList);
        }, (error) => {
            console.error("Error fetching orders:", error);
        });
        return () => unsubscribe();
    }, [db, isAuthReady, appId]);

    const updateOrderStatus = async (orderId, userId, newStatus) => {
        if (!db) {
            console.error("Firestore DB no está inicializado.");
            showAlert("Error: Base de datos no disponible.");
            return;
        }

        // Verificación crítica: Asegurarse de que el userId existe
        if (!userId) {
             console.error("Error: userId no está disponible para la orden:", orderId);
             showAlert("Error: El ID de usuario no está disponible para esta orden. No se puede actualizar la subcolección.");
             return;
        }
        
        try {
            // Creamos un batch para realizar múltiples escrituras atómicas
            const batch = writeBatch(db);

            // 1. Referencia al documento en la colección principal 'orders'
            const mainOrderRef = doc(db, `artifacts/${appId}/public/data/orders`, orderId);
            
            // 2. Referencia al documento en la subcolección del usuario 'users/{userId}/orders'
            const userOrderRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderId);

            // 3. Agregamos las operaciones de actualización al batch
            batch.update(mainOrderRef, { paymentStatus: newStatus });
            batch.update(userOrderRef, { paymentStatus: newStatus });
            
            // 4. Aplicamos los cambios atómicamente
            await batch.commit();

            showAlert(`Estado de la orden ${orderId} actualizado a ${newStatus} en ambas colecciones.`);
            console.log(`Estado de la orden ${orderId} actualizado a ${newStatus} en ambas colecciones.`);

        } catch (error) {
            console.error('Error al actualizar el estado de la orden:', error);
            showAlert(`Error al actualizar el estado: ${error.message}`);
        }
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Gestión de Órdenes</h1>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Lista de Órdenes</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg">
                    <thead>
                        <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                            <th className="py-3 px-6 text-left">ID de Orden</th>
                            <th className="py-3 px-6 text-left">ID de Usuario</th>
                            <th className="py-3 px-6 text-left">Estado</th>
                            <th className="py-3 px-6 text-left">Total</th>
                            <th className="py-3 px-6 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 text-sm font-light">
                        {orders.map(order => (
                            <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="py-3 px-6 text-left whitespace-nowrap">{order.id}</td>
                                <td className="py-3 px-6 text-left whitespace-nowrap">{order.userId}</td>
                                <td className="py-3 px-6 text-left whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        order.paymentStatus === 'APROBADO' ? 'bg-green-200 text-green-800' :
                                        order.paymentStatus === 'PENDIENTE' ? 'bg-yellow-200 text-yellow-800' :
                                        order.paymentStatus === 'FALLIDO' ? 'bg-red-200 text-red-800' :
                                        'bg-gray-200 text-gray-800'
                                    }`}>
                                        {order.paymentStatus || 'Desconocido'}
                                    </span>
                                </td>
                                <td className="py-3 px-6 text-left whitespace-nowrap">${order.total}</td>
                                <td className="py-3 px-6 text-center">
                                    <div className="flex item-center justify-center space-x-2">
                                        <button 
                                            onClick={() => updateOrderStatus(order.id, order.userId, 'APROBADO')}
                                            className="bg-green-500 text-white py-1 px-3 rounded-full text-xs hover:bg-green-600 transition-colors"
                                        >
                                            Aprobar
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus(order.id, order.userId, 'FALLIDO')}
                                            className="bg-red-500 text-white py-1 px-3 rounded-full text-xs hover:bg-red-600 transition-colors"
                                        >
                                            Fallar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    );
};

// Componente de Autenticación
const AuthGate = ({ children }) => {
  const { auth, isAuthReady, userId, isAdmin, signInWithToken, showAlert } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (auth && token) {
          await signInWithToken(token);
        } else {
          console.log("No initial auth token found. User might be unauthenticated.");
        }
      } catch (err) {
        console.error("Error signing in with custom token:", err);
        setError("Error de autenticación. Por favor, recarga la página.");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [auth, signInWithToken]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando autenticación...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;
  }
  
  if (!userId) {
    return <Login />;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <p className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</p>
          <p className="text-gray-700">No tienes permisos de administrador para ver este contenido.</p>
        </div>
      </div>
    );
  }

  return children;
};

// Componente principal de la aplicación
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { modalState, showAlert, showConfirm, closeModal } = useModal();
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  useEffect(() => {
    let app, authInstance, dbInstance;
    try {
        const apps = getApps();
        if (apps && apps.length > 0) {
            app = getApp();
        } else {
            const firebaseConfig = JSON.parse(__firebase_config);
            app = initializeApp(firebaseConfig);
        }
        authInstance = getAuth(app);
        dbInstance = getFirestore(app);
        
        setAuth(authInstance);
        setDb(dbInstance);

    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }

    if (authInstance) {
        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setUserId(user.uid);
                // Aquí se verifica si el usuario es administrador
                const adminDocRef = doc(dbInstance, `artifacts/${appId}/admins`, user.uid);
                try {
                    const adminDocSnap = await getDoc(adminDocRef);
                    setIsAdmin(adminDocSnap.exists());
                } catch (error) {
                    console.error("Error al verificar permisos de administrador:", error);
                    setIsAdmin(false);
                }
            } else {
                setUserId(null);
                setIsAdmin(false);
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }
  }, [appId]);
  
  const signInWithToken = async (token) => {
    if (auth) {
      try {
        await signInWithCustomToken(auth, token);
      } catch (error) {
        console.error("Error signing in with custom token:", error);
        throw error;
      }
    }
  };

  const appContextValue = {
    db,
    auth,
    isAuthReady,
    userId,
    isAdmin,
    signInWithToken,
    showAlert,
    showConfirm,
    closeModal
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="flex min-h-screen bg-gray-100 text-gray-800 font-sans antialiased">
        <AuthGate>
          <div className="flex flex-col w-full">
            {/* Header */}
            <nav className="bg-white shadow-lg p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-2xl font-bold text-blue-600">Admin Dashboard</div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-600 font-medium">Usuario: {userId}</span>
                <button
                    onClick={() => signOut(auth)}
                    className="bg-red-500 text-white py-2 px-4 rounded-md font-semibold hover:bg-red-600 transition-colors"
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
                {currentPage === 'dashboard' && <Dashboard />}
                {currentPage === 'products' && <Products />}
                {currentPage === 'orders' && <Orders />}
              </main>
            </div>
          </div>
        </AuthGate>
      </div>
      <CustomModal {...modalState} />
    </AppContext.Provider>
  );
};

export default App;
