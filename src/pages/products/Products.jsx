import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AppContext } from '../../contexts/AppContext.jsx';
import { useModal } from '../../hooks/useModal.js';

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
    imagen: null,
    imagenUrl: '',
  });

  useEffect(() => {
    console.log("Products.jsx: useEffect se ejecutó.");
    if (!db) {
      console.log("Products.jsx: db no está disponible.");
      setError("La base de datos no está inicializada.");
      setLoading(false);
      return;
    }

    console.log("Products.jsx: Intentando obtener productos de Firestore...");
    const q = query(collection(db, 'productos'), orderBy('fechaCreacion', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Log para verificar el tipo de 'precio' DESPUÉS de la conversión al obtener los datos
        console.log(`Products.jsx: Data from Firestore - Product ID: ${doc.id}, Precio (raw): ${data.precio}, Tipo (raw): ${typeof data.precio}`);
        
        const parsedPrecio = parseFloat(data.precio) || 0;
        const parsedCantidad = parseInt(data.cantidadInventario, 10) || 0;

        console.log(`Products.jsx: Data after parsing - Product ID: ${doc.id}, Precio (parsed): ${parsedPrecio}, Tipo (parsed): ${typeof parsedPrecio}`);

        return {
          id: doc.id,
          ...data,
          precio: parsedPrecio,
          cantidadInventario: parsedCantidad
        };
      });
      console.log("Products.jsx: Datos de productos recibidos y procesados:", productsData);
      setProducts(productsData);
      setLoading(false);
    }, (err) => {
      console.error("Products.jsx: Error al obtener productos:", err);
      setError("Error al cargar productos: " + err.message);
      setLoading(false);
    });

    return () => {
      console.log("Products.jsx: Limpiando suscripción de onSnapshot.");
      unsubscribe();
    };
  }, [db]); // Asegúrate de que 'db' sea una dependencia aquí

  // Añadido para observar el estado de products, loading, error, y isAdding
  useEffect(() => {
    console.log("Products.jsx: Estado actual de products:", products);
    console.log("Products.jsx: Estado actual de loading:", loading);
    console.log("Products.jsx: Estado actual de error:", error);
    console.log("Products.jsx: Estado actual de isAdding:", isAdding); // Agregado para depurar el botón
  }, [products, loading, error, isAdding]); // isAdding agregado a las dependencias


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
    if (!imageFile) {
      console.log("Products.jsx: No hay archivo de imagen para subir.");
      return null;
    }
    if (!storage) {
        console.error("Products.jsx: Firebase Storage no está disponible.");
        throw new Error("Firebase Storage no está inicializado.");
    }
    const storageRef = ref(storage, `product_images/${imageFile.name}_${Date.now()}`);
    console.log("Products.jsx: Subiendo imagen a Storage...");
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    console.log("Products.jsx: Imagen subida. URL:", downloadURL);
    return downloadURL;
  };

  const handleAddProduct = async (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario
    console.log("Products.jsx: handleAddProduct iniciado.");
    console.log("Products.jsx: Valores del formulario (newProduct):", newProduct);
    console.log("Products.jsx: Tipo de newProduct.precio ANTES de parseFloat:", typeof newProduct.precio);
    console.log("Products.jsx: Tipo de newProduct.cantidadInventario ANTES de parseInt:", typeof newProduct.cantidadInventario);

    if (!db) {
        console.error("Products.jsx: Firebase Firestore no está disponible para añadir producto.");
        showAlert("Error: La base de datos no está inicializada para añadir productos.");
        setLoading(false);
        return;
    }
    if (!storage) {
        console.error("Products.jsx: Firebase Storage no está disponible para subir imágenes.");
        showAlert("Error: El almacenamiento no está inicializado para subir imágenes.");
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      let imageUrl = '';
      if (newProduct.imagen) {
        console.log("Products.jsx: Imagen detectada, intentando subir...");
        imageUrl = await uploadImage(newProduct.imagen);
      } else {
        console.log("Products.jsx: No se seleccionó ninguna imagen.");
      }

      const productDataToSave = {
        nombre: newProduct.nombre,
        descripcion: newProduct.descripcion,
        precio: parseFloat(newProduct.precio),
        cantidadInventario: parseInt(newProduct.cantidadInventario, 10),
        categoria: newProduct.categoria,
        imagenUrl: imageUrl,
        fechaCreacion: new Date(),
        ultimaActualizacion: new Date(),
        activo: true,
      };
      console.log("Products.jsx: Añadiendo documento a Firestore con datos:", productDataToSave);

      await addDoc(collection(db, 'productos'), productDataToSave);
      console.log("Products.jsx: Producto añadido con éxito a Firestore.");
      showAlert('Producto añadido con éxito.');
      resetForm();
    } catch (err) {
      console.error('Products.jsx: Error añadiendo producto:', err);
      showAlert(`Error al añadir producto: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("Products.jsx: handleAddProduct finalizado. Loading:", false);
    }
  };

  const handleEditProduct = (product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setNewProduct({
      nombre: product.nombre,
      descripcion: product.descripcion,
      // Asegúrate de que los valores numéricos sean correctos al cargar para editar
      precio: typeof product.precio === 'number' ? product.precio : parseFloat(product.precio) || '',
      cantidadInventario: typeof product.cantidadInventario === 'number' ? product.cantidadInventario : parseInt(product.cantidadInventario, 10) || '',
      categoria: product.categoria,
      imagen: null,
      imagenUrl: product.imagenUrl,
    });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = newProduct.imagenUrl;
      if (newProduct.imagen) {
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
          onClick={() => {
            console.log("Products.jsx: Botón 'Añadir Nuevo Producto' clicado.");
            setIsAdding(true);
            resetForm();
            console.log("Products.jsx: isAdding después del clic (debería ser true):", true);
          }}
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
                {products.map((product) => {
                  console.log(`Products.jsx: Render - Product ID: ${product.id}, Precio: ${product.precio}, Typeof Precio: ${typeof product.precio}`);
                  
                  let displayPrice = 0;
                  if (typeof product.precio === 'number' && !isNaN(product.precio)) {
                    displayPrice = product.precio;
                  } else {
                    const parsedPrice = parseFloat(product.precio);
                    if (!isNaN(parsedPrice)) {
                      displayPrice = parsedPrice;
                    } else {
                      console.error(`Products.jsx: Valor de precio inesperado para el producto ${product.id}: ${product.precio}. No es un número válido.`);
                    }
                  }

                  return (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPrice.toFixed(2)}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};

export default Products;