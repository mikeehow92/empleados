import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { AppContext } from './AppContext.jsx';
import { useModal } from './hooks/useModal.js';
import CustomModal from './components/CustomModal.jsx';

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

        // Si estado es un objeto, intenta encontrar una cadena de estado válida
        if (typeof estado === 'object' && estado !== null) {
          estado = estado.value || 'desconocido';
        }
        
        return {
          id: doc.id,
          ...data,
          estado: estado,
        };
      });
      setOrders(ordersData);
      setLoading(false);
      console.log("Orders.jsx: Órdenes obtenidas con éxito.");
    }, (err) => {
      console.error("Orders.jsx: Error al obtener órdenes:", err);
      setError("Error al cargar órdenes.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    if (!db) {
      showAlert('La base de datos no está disponible.');
      return;
    }
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await updateDoc(orderDocRef, { estado: newStatus });
      showAlert(`Estado de la orden ${orderId} actualizado a ${newStatus}.`);
    } catch (err) {
      console.error("Error al actualizar el estado de la orden:", err);
      showAlert(`Error al actualizar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Cargando órdenes...</div>;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Gestión de Órdenes</h1>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {orders.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No hay órdenes para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID de Orden
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artículos
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actualizar Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.fechaOrden && order.fechaOrden.toDate().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${order.estado === 'pendiente' && 'bg-yellow-100 text-yellow-800'}
                        ${order.estado === 'procesando' && 'bg-blue-100 text-blue-800'}
                        ${order.estado === 'enviado' && 'bg-purple-100 text-purple-800'}
                        ${order.estado === 'entregado' && 'bg-green-100 text-green-800'}
                        ${order.estado === 'cancelado' && 'bg-red-100 text-red-800'}
                      `}>
                        {typeof order.estado === 'string' ? order.estado : 'Estado Inválido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <ul className="list-disc list-inside">
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
