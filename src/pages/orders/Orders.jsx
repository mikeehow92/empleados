import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { AppContext } from '../../contexts/AppContext.jsx';
import { useModal } from '../../hooks/useModal.js';

// Componente de Gestión de Órdenes
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
    const q = query(collection(db, 'orders'), orderBy('fechaOrden', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        let estado = data.estado;

        if (typeof estado === 'object' && estado !== null) {
          console.warn(`Orders.jsx: 'estado' para la orden ${doc.id} es un objeto. Intentando analizar o establecer un valor predeterminado.`);
          const foundStatusKey = orderStatuses.find(statusKey => Object.keys(estado).includes(statusKey));
          if (foundStatusKey) {
            estado = foundStatusKey;
            console.log(`Orders.jsx: 'estado' analizado de objeto a cadena: ${estado}`);
          } else {
            estado = 'desconocido';
            console.warn(`Orders.jsx: No se encontró una clave de estado válida en el objeto para la orden ${doc.id}. Se establece 'desconocido'.`);
          }
        } else if (typeof estado !== 'string') {
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
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { estado: newStatus });
      showAlert('Estado de la orden actualizado con éxito.');
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id.substring(0, 8)}...</td>
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
                        {/* CAMBIO CLAVE AQUÍ: Usar order.items y las propiedades name y quantity */}
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

export default Orders;
