// Orders.jsx
import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AppContext } from './AppContext.jsx';
import { useModal } from './hooks/useModal.js';
import CustomModal from './components/CustomModal.jsx';

// Componente de Gestión de Órdenes
const Orders = () => {
  const { db, app } = useContext(AppContext);
  const { showAlert, showConfirm, closeModal, modalState } = useModal();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orderStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];

  useEffect(() => {
    if (!db) {
      setError("La base de datos no está inicializada.");
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'orders'), orderBy('fechaOrden', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        let estado = data.estado;
        if (typeof estado === 'object' && estado && estado.estado) {
            estado = estado.estado;
        }
        return {
          id: doc.id,
          ...data,
          estado: estado
        };
      });
      setOrders(ordersData);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener las órdenes:", err);
      setError("Error al cargar las órdenes.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleUpdateOrderStatus = async (orderId, userId, newStatus) => {
    if (!db || !app) {
      showAlert("Error: La base de datos o la app de Firebase no están inicializadas.");
      return;
    }

    showConfirm(`¿Estás seguro de que quieres cambiar el estado a "${newStatus}"?`, async () => {
      closeModal();
      try {
        const functions = getFunctions(app);
        const updateOrderStatus = httpsCallable(functions, 'updateOrderStatus');

        const result = await updateOrderStatus({
          orderId: orderId,
          userId: userId,
          newStatus: newStatus,
        });

        console.log('Respuesta de Cloud Function:', result.data);
        showAlert(`¡Estado de la orden ${orderId} actualizado con éxito!`);
      } catch (error) {
        console.error('Error al actualizar el estado de la orden:', error);
        showAlert(`Error al actualizar el estado de la orden: ${error.message}`);
      }
    });
  };

  // ... (El resto de tu código del componente Orders)

  if (loading) {
    return <div className="text-center p-8">Cargando órdenes...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Órdenes</h1>
      <div className="bg-white rounded-lg shadow-md p-4">
        {orders.length === 0 ? (
          <p className="text-center text-gray-500">No hay órdenes disponibles.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID de Orden</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-100 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.fechaOrden ? new Date(order.fechaOrden.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.total.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${order.estado === 'entregado' ? 'bg-green-100 text-green-800' :
                        order.estado === 'cancelado' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                        }`}>
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
                        onChange={(e) => handleUpdateOrderStatus(order.id, order.userId, e.target.value)}
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
