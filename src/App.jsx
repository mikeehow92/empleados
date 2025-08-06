import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, limit, getDoc, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Importa solo la configuración de Firebase
import { firebaseConfig as localFirebaseConfig } from './firebase/firebaseConfig';

// Contexto para el estado de autenticación y la base de datos
// Este contexto proveerá acceso a `auth`, `db`, `storage`, `userId` y la función `showAlert` a todos los componentes hijos.
const AppContext = createContext(null);

// =============================================================================
// Componentes de la Interfaz de Usuario
// =============================================================================

// Componente Modal personalizado para alertas y confirmaciones
// Utiliza un estado centralizado para mostrar mensajes modales sin usar `alert()`
const CustomModal = ({ message, onConfirm, onCancel, type }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center animate-fade-in-up">
        <p className="text-lg font-semibold mb-4 text-gray-800">{message}</p>
        {type === 'confirm' ? (
          <div className="flex justify-around gap-4">
            <button
              onClick={onConfirm}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md transform hover:scale-105"
            >
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors shadow-md transform hover:scale-105"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md transform hover:scale-105"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

// Hook personalizado para gestionar el estado del modal de forma centralizada
const useModal = () => {
  const [modalState, setModalState] = useState({
    message: '',
    onConfirm: null,
    onCancel: null,
    type: 'alert',
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

// Componente para mostrar un spinner de carga
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full min-h-[300px]">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
  </div>
);

// =============================================================================
// Componentes del Panel de Administración
// =============================================================================

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
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md animate-fade-in">
        <h2 className="text-4xl font-extrabold text-center text-gray-900 mb-8">Iniciar Sesión Admin</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
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
    totalRevenue: 0, // Nuevo campo para ingresos totales
    averageOrderValue: 0, // Nuevo campo para valor promedio de orden
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db) return;

    const fetchSummary = async () => {
      try {
        // Obteniendo productos
        const productsQuery = collection(db, 'productos');
        const productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
          const productsData = snapshot.docs.map(doc => doc.data());
          const lowStock = productsData.filter(p => p.cantidadInventario < 10).length;
          setSummary(prev => ({
            ...prev,
            totalProducts: productsData.length,
            lowStockProducts: lowStock,
          }));
        }, (err) => {
          console.error("Error fetching products for dashboard:", err);
          setError("Error al cargar datos de productos.");
        });

        // Obteniendo órdenes
        const ordersQuery = collection(db, 'orders');
        const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map(doc => doc.data());
          const pending = ordersData.filter(o => o.estado === 'pendiente' || o.estado === 'procesando').length;
          const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total || 0), 0);
          const averageOrderValue = ordersData.length > 0 ? totalRevenue / ordersData.length : 0;
          setSummary(prev => ({
            ...prev,
            totalOrders: ordersData.length,
            pendingOrders: pending,
            totalRevenue: totalRevenue,
            averageOrderValue: averageOrderValue,
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

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Resumen del Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Productos Totales" value={summary.totalProducts} color="blue" />
        <DashboardCard title="Órdenes Totales" value={summary.totalOrders} color="green" />
        <DashboardCard title="Órdenes Pendientes" value={summary.pendingOrders} color="yellow" />
        <DashboardCard title="Poco Stock" value={summary.lowStockProducts} color="red" />
        <DashboardCard title="Ingresos Totales" value={`$${summary.totalRevenue.toFixed(2)}`} color="purple" />
        <DashboardCard title="Valor Promedio de Orden" value={`$${summary.averageOrderValue.toFixed(2)}`} color="indigo" />
      </div>
    </div>
  );
};

const DashboardCard = ({ title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };
  return (
    <div className={`bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center transform transition-transform duration-300 hover:scale-105 border-b-4 ${colorClasses[color]}`}>
      <div className="text-4xl font-bold text-gray-800 mb-2">{value}</div>
      <p className="text-lg text-gray-600">{title}</p>
    </div>
  );
};


// Componente de Gestión de Productos
const Products = () => {
  const { db, storage } = useContext(AppContext);
  const { modalState, showAlert, showConfirm, closeModal } = useModal();
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
    imagen: null,
    imagenUrl: '',
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

  const deleteImage = async (imageUrl) => {
    if (!imageUrl) return;
    try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error) {
        console.error("Error deleting image:", error);
        // No alert, as it's not critical for the main flow
    }
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

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = newProduct.imagenUrl;
      if (newProduct.imagen && newProduct.imagen !== currentProduct.imagen) {
        // Si hay una nueva imagen, subirla y borrar la anterior
        if (currentProduct.imagenUrl) {
            await deleteImage(currentProduct.imagenUrl);
        }
        imageUrl = await uploadImage(newProduct.imagen);
      }
      await updateDoc(doc(db, 'productos', currentProduct.id), {
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

  const handleDeleteProduct = (productId, imageUrl) => {
    showConfirm(
      '¿Estás seguro de que quieres eliminar este producto?',
      async () => {
        try {
          await deleteDoc(doc(db, 'productos', productId));
          if (imageUrl) {
            await deleteImage(imageUrl);
          }
          showAlert('Producto eliminado con éxito.');
        } catch (err) {
          console.error('Error eliminando producto:', err);
          showAlert(`Error al eliminar producto: ${err.message}`);
        }
      }
    );
  };

  const handleEditClick = (product) => {
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

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-white min-h-screen rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestión de Productos</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-md"
        >
          Añadir Producto
        </button>
      </div>

      {(isAdding || isEditing) && (
        <div className="mb-8 p-6 border rounded-lg shadow-md bg-gray-50 animate-fade-in">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h2>
          <form onSubmit={isEditing ? handleEditProduct : handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={newProduct.nombre}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                name="descripcion"
                value={newProduct.descripcion}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              ></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Precio</label>
                <input
                  type="number"
                  name="precio"
                  value={newProduct.precio}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Cantidad en Inventario</label>
                <input
                  type="number"
                  name="cantidadInventario"
                  value={newProduct.cantidadInventario}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  required
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <input
                type="text"
                name="categoria"
                value={newProduct.categoria}
                onChange={handleInputChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Imagen</label>
              <input
                type="file"
                name="imagen"
                onChange={handleImageChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {newProduct.imagenUrl && (
                <img src={newProduct.imagenUrl} alt="Vista previa" className="mt-2 h-20 w-20 object-cover rounded-md" />
              )}
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700"
                disabled={loading}
              >
                {isEditing ? 'Guardar Cambios' : 'Añadir Producto'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md font-semibold hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden transform transition-transform duration-300 hover:scale-105">
            <img
              src={product.imagenUrl || 'https://placehold.co/400x300/E0E0E0/333333?text=Sin+Imagen'}
              alt={product.nombre}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-xl font-bold text-gray-800">{product.nombre}</h3>
              <p className="text-gray-600 mt-1">{product.descripcion}</p>
              <p className="text-lg font-semibold text-blue-600 mt-2">${product.precio?.toFixed(2) || '0.00'}</p>
              <p className="text-sm text-gray-500">Stock: {product.cantidadInventario}</p>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => handleEditClick(product)}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteProduct(product.id, product.imagenUrl)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};


// Componente de la página de Órdenes
const Orders = () => {
    const { db, showAlert } = useContext(AppContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState(null);

    // FUNCIÓN CLAVE: Actualiza el estado de la orden en la colección principal
    const updateOrderStatus = async (orderId, newStatus) => {
        if (!db) {
            showAlert("Firestore no está disponible.");
            return;
        }

        try {
            const orderDocRef = doc(db, 'orders', orderId);
            
            await updateDoc(orderDocRef, {
                estado: newStatus,
                ultimaActualizacion: new Date(),
            });

            showAlert(`Estado de la orden ${orderId} actualizado a '${newStatus}' con éxito.`, () => {});
        } catch (error) {
            console.error("Error al actualizar el estado de la orden:", error);
            showAlert(`Error al actualizar la orden: ${error.message}`, () => {});
        }
    };

    const toggleOrderDetails = (orderId) => {
        setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
    };

    useEffect(() => {
        if (!db) return;
        setLoading(true);

        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('fechaOrden', 'desc'), limit(50));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching orders:", error);
            showAlert("Error al cargar las órdenes. Por favor, recarga la página.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, showAlert]);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="p-6 bg-white min-h-screen rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Panel de Órdenes</h1>
            {orders.length === 0 ? (
                <p className="text-gray-600">No hay órdenes para mostrar.</p>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <div key={order.id} className="bg-gray-50 p-6 rounded-lg shadow-md border-l-4 border-blue-500 transform transition-transform duration-300 hover:scale-[1.01]">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleOrderDetails(order.id)}>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-semibold text-gray-800 truncate">Orden ID: {order.id}</h2>
                                    <p className="text-gray-600 text-sm mt-1">Total: <span className="font-bold">${order.total?.toFixed(2) || '0.00'}</span></p>
                                    <p className="text-gray-600 text-xs">Fecha: {new Date(order.fechaOrden?.seconds * 1000).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                                        order.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                        order.estado === 'procesando' ? 'bg-blue-100 text-blue-800' :
                                        order.estado === 'enviado' ? 'bg-green-100 text-green-800' :
                                        order.estado === 'entregado' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {order.estado ? order.estado.toUpperCase() : 'PENDIENTE'}
                                    </span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-6 w-6 text-gray-500 transition-transform duration-300 ${expandedOrderId === order.id ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {expandedOrderId === order.id && (
                                <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in-up">
                                    <p className="text-gray-600 text-sm mb-2">Usuario ID: <span className="font-mono">{order.userId}</span></p>
                                    
                                    <h3 className="font-semibold mt-4 mb-2 text-gray-700">Detalles de Envío:</h3>
                                    <p className="text-gray-600 text-sm">Teléfono: {order.shippingDetails?.phone}</p>
                                    <p className="text-gray-600 text-sm">Dirección: {order.shippingDetails?.address}, {order.shippingDetails?.municipality}, {order.shippingDetails?.department}</p>
                                    
                                    <h3 className="font-semibold mt-4 mb-2 text-gray-700">Artículos:</h3>
                                    <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                                        {order.items.map((item, index) => (
                                            <li key={index}>
                                                <span className="font-medium">{item.name}</span> - Cantidad: {item.quantity} - Precio: ${item.price?.toFixed(2) || '0.00'}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'procesando')}
                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                                        >
                                            Marcar como 'Procesando'
                                        </button>
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'enviado')}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors shadow-sm"
                                        >
                                            Marcar como 'Enviado'
                                        </button>
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'entregado')}
                                            className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-md hover:bg-purple-600 transition-colors shadow-sm"
                                        >
                                            Marcar como 'Entregado'
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// Componente de Gestión de Usuarios
// =============================================================================
const Users = () => {
  const { db, showAlert } = useContext(AppContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    // En un entorno de producción real, se usaría Cloud Functions para esto, pero para este ejemplo,
    // se carga la colección 'users' para que el administrador pueda ver a los usuarios.
    // Asumiendo que la seguridad de las reglas de Firestore permite al admin leer esta colección.
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      showAlert("Error al cargar la lista de usuarios.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, showAlert]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 bg-white min-h-screen rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Gestión de Usuarios</h1>
      {users.length === 0 ? (
        <p className="text-gray-600">No hay usuarios para mostrar.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => (
            <div key={user.id} className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">ID: {user.id}</h3>
              <p className="text-sm text-gray-600">Email: {user.email || 'N/A'}</p>
              <p className={`text-sm font-bold mt-1 ${user.isAdmin ? 'text-green-600' : 'text-gray-500'}`}>
                Rol: {user.isAdmin ? 'Admin' : 'Usuario'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// =============================================================================
// Componente Principal de la Aplicación
// =============================================================================
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { modalState, showAlert } = useModal();

  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localFirebaseConfig;
        if (!getApps().length) {
          initializeApp(firebaseConfig);
        }
        const firebaseAuth = getAuth();
        const firestoreDb = getFirestore();
        const firebaseStorage = getStorage();
        setAuth(firebaseAuth);
        setDb(firestoreDb);
        setStorage(firebaseStorage);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
          if (currentUser) {
            const userDocRef = doc(firestoreDb, "users", currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.exists() ? userDoc.data() : { isAdmin: false };
            if (userData.isAdmin) {
              setUser(currentUser);
              setIsAuthReady(true);
              showAlert('Inicio de sesión exitoso. Bienvenido, Admin!');
            } else {
              await signOut(firebaseAuth);
              showAlert('Acceso denegado. Solo administradores pueden iniciar sesión.');
              setUser(null);
              setIsAuthReady(true);
            }
          } else {
            setUser(null);
            setIsAuthReady(true);
          }
        });

        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(firebaseAuth, __initial_auth_token);
        }

        return () => unsubscribe();
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        showAlert(`Error al inicializar Firebase: ${error.message}`);
      }
    };
    initFirebase();
  }, []);

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        showAlert('Has cerrado sesión correctamente.');
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showAlert(`Error al cerrar sesión: ${error.message}`);
      }
    }
  };

  const userId = user?.uid;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <AppContext.Provider value={{ auth, db, storage, showAlert }}>
        <Login />
        <CustomModal {...modalState} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={{ auth, db, storage, userId, showAlert }}>
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-800">
        <nav className="bg-white shadow-md p-4 flex justify-between items-center z-10">
          <h1 className="text-2xl font-bold text-blue-800">Panel de Administración</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 hidden md:block">
              Usuario ID: <span className="font-mono text-sm">{userId}</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors shadow-md"
            >
              Salir
            </button>
          </div>
        </nav>

        <div className="flex flex-1">
          {/* Sidebar */}
          <aside className="w-64 bg-blue-800 text-white p-6 shadow-xl">
            <nav className="space-y-4">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'dashboard' ? 'bg-blue-600 font-semibold' : 'hover:bg-blue-700'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage('products')}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'products' ? 'bg-blue-600 font-semibold' : 'hover:bg-blue-700'}`}
              >
                Productos
              </button>
              <button
                onClick={() => setCurrentPage('orders')}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'orders' ? 'bg-blue-600 font-semibold' : 'hover:bg-blue-700'}`}
              >
                Órdenes
              </button>
              <button
                onClick={() => setCurrentPage('users')}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentPage === 'users' ? 'bg-blue-600 font-semibold' : 'hover:bg-blue-700'}`}
              >
                Usuarios
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {currentPage === 'dashboard' && <Dashboard />}
            {currentPage === 'products' && <Products />}
            {currentPage === 'orders' && <Orders />}
            {currentPage === 'users' && <Users />}
          </main>
        </div>
      </div>
      <CustomModal {...modalState} />
    </AppContext.Provider>
  );
};

export default App;
