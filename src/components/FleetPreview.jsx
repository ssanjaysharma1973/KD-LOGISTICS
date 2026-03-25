import React, { useState, useEffect } from 'react';
import { User, LogOut, MapPin, Plus, Route, IndianRupee, Shield } from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from "./ui/card";
import Button from "./ui/button";
import Badge from "./ui/badge";
import Input from "./ui/input";

// Simulate API delay for more realistic testing
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Local simulated API with error handling (kept for UI preview)
const api = {
  fetchVehicles: async () => {
    await delay(500);
    return [
      {
        id: 'VH001',
        imei: '123456789012345',
        model: 'Tata Ace',
        status: 'active',
        authorized: true,
        driver: 'John Doe',
        obd: {
          speed: 45,
          engineTemp: 92,
          fuelLevel: 80,
          batteryVoltage: 12.8
        },
        currentLocation: { lat: '19.0760', lng: '72.8777' },
        expenses: {
          fuel: 5000,
          maintenance: 2000,
          tolls: 1500
        }
      }
    ];
  },
  fetchRoutePoints: async () => {
    await delay(300);
    return [
      { name: 'Mumbai Port', city: 'Mumbai', lat: '19.0760', lng: '72.8777' },
      { name: 'Delhi Hub', city: 'Delhi', lat: '28.7041', lng: '77.1025' }
    ];
  },
  addVehicle: async (data) => {
    await delay(400);
    return {
      ...data,
      status: 'inactive',
      authorized: true,
      driver: 'Unassigned',
      obd: {
        speed: 0,
        engineTemp: 0,
        fuelLevel: 100,
        batteryVoltage: 12.0
      },
      currentLocation: null,
      expenses: {
        fuel: 0,
        maintenance: 0,
        tolls: 0
      }
    };
  },
  addRoutePoint: async (data) => {
    await delay(300);
    return data;
  },
  updateVehicle: async (id, data) => {
    await delay(300);
    return { id, ...data };
  },
  updateExpenses: async (id, expenses) => {
    await delay(300);
    return { id, expenses };
  }
};

const FleetPreview = () => {
  const [vehicles, setVehicles] = useState([]);
  const [points, setPoints] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [vehiclesData, pointsData] = await Promise.all([
          api.fetchVehicles(),
          api.fetchRoutePoints()
        ]);
        setVehicles(vehiclesData || []);
        setPoints(pointsData || []);
      } catch (error) {
        setError('Failed to fetch data. Please try again.');
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddVehicle = async (formData) => {
    try {
      const newVehicle = await api.addVehicle(formData);
      setVehicles(prev => [...prev, newVehicle]);
      setShowAddVehicle(false);
    } catch (error) {
      console.error('Error adding vehicle:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleRouteUpdate = async (vehicleId, routeData) => {
    try {
      const updatedVehicle = await api.updateVehicle(vehicleId, {
        route: routeData,
        status: 'active'
      });
      setVehicles(prev => prev.map(v => v.id === vehicleId ? updatedVehicle : v));
      setShowRouteModal(false);
    } catch (error) {
      console.error('Error updating route:', error);
    }
  };

  const handleExpenseUpdate = async (vehicleId, expenses) => {
    try {
      const { expenses: updatedExpenses } = await api.updateExpenses(vehicleId, expenses);
      setVehicles(prev => prev.map(v => 
        v.id === vehicleId ? { ...v, expenses: updatedExpenses } : v
      ));
    } catch (error) {
      console.error('Error updating expenses:', error);
    }
  };

  const handleAddPoint = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const pointData = {
      name: formData.get('pointName'),
      city: formData.get('city'),
      lat: formData.get('latitude'),
      lng: formData.get('longitude')
    };

    try {
      const newPoint = await api.addRoutePoint(pointData);
      setPoints(prev => [...prev, newPoint]);
      event.target.reset();
    } catch (error) {
      console.error('Error adding point:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Rest of your JSX remains the same */}
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Fleet Management</h1>
          <Badge variant="outline">
            <User className="w-4 h-4 mr-2" />
            Admin
          </Badge>
        </div>
        <Button variant="outline">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Route Points</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPoint} className="space-y-4">
                <Input name="pointName" placeholder="Point Name" required />
                <Input name="city" placeholder="City" required />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="latitude" type="number" step="any" placeholder="Latitude" required />
                  <Input name="longitude" type="number" step="any" placeholder="Longitude" required />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Point
                </Button>
              </form>

              <div className="mt-4 space-y-2">
                <h3 className="font-medium">Saved Points</h3>
                {points.map((point, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{point.name}</p>
                      <p className="text-sm text-gray-500">{point.city}</p>
                      <p className="text-xs text-gray-400">{point.lat}, {point.lng}</p>
                    </div>
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedVehicle && (
            <Card>
              <CardHeader>
                <CardTitle>Vehicle OBD Data</CardTitle>
              </CardHeader>
              <CardContent>
                {/* OBD data content remains the same */}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Area */}
        <div className="col-span-9">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Live Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                {points.map((point, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${((Number(point.lng) + 180) / 360) * 100}%`,
                      top: `${((90 - Number(point.lat)) / 180) * 100}%`
                    }}
                  >
                    <div className="absolute -top-6 left-2 text-xs whitespace-nowrap bg-white px-2 py-1 rounded shadow">
                      {point.name}
                    </div>
                  </div>
                ))}

                {vehicles.map((vehicle, i) => 
                  vehicle.currentLocation && (
                    <div
                      key={i}
                      className={`absolute w-4 h-4 ${
                        vehicle.authorized ? 'bg-green-500' : 'bg-red-500'
                      } rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse`}
                      style={{
                        left: `${((Number(vehicle.currentLocation.lng) + 180) / 360) * 100}%`,
                        top: `${((90 - Number(vehicle.currentLocation.lat)) / 180) * 100}%`
                      }}
                    >
                      <div className="absolute -top-6 left-2 text-xs whitespace-nowrap bg-white px-2 py-1 rounded shadow">
                        {vehicle.id} ({vehicle.obd?.speed || 0} km/h)
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Vehicle Management</CardTitle>
                <Button onClick={() => setShowAddVehicle(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vehicle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Vehicle</th>
                      <th className="text-left p-4">Auth</th>
                      <th className="text-left p-4">Driver</th>
                      <th className="text-left p-4">Speed</th>
                      <th className="text-left p-4">Engine</th>
                      <th className="text-left p-4">Battery</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map(vehicle => (
                      <tr 
                        key={vehicle.id} 
                        className={`border-b hover:bg-gray-50 cursor-pointer ${
                          selectedVehicle?.id === vehicle.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        <td className="p-4">
                          <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'}>
                            {vehicle.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div>
                            <div>{vehicle.id}</div>
                            <div className="text-sm text-gray-500">{vehicle.model}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={vehicle.authorized ? 'outline' : 'destructive'}>
                            <Shield className="w-4 h-4 mr-1" />
                            {vehicle.authorized ? 'Verified' : 'Invalid'}
                          </Badge>
                        </td>
                        <td className="p-4">{vehicle.driver}</td>
                        <td className="p-4">{vehicle.obd?.speed || 0} km/h</td>
                        <td className="p-4">{vehicle.obd?.engineTemp || 0}°C</td>
                        <td className="p-4">{vehicle.obd?.batteryVoltage || 0}V</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVehicle(vehicle);
                                setShowRouteModal(true);
                              }}
                            >
                              <Route className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVehicle(vehicle);
                                setShowExpenseModal(true);
                              }}
                            >
                              <IndianRupee className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[500px]">
            <CardHeader>
              <CardTitle>Add New Vehicle</CardTitle>
            </CardHeader>
            <CardContent>
              <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleAddVehicle({
                  id: formData.get('vehicleId'),
                  imei: formData.get('imei'),
                  model: formData.get('model')
                });
              }}
            >
              <div>
                <label className="text-sm font-medium">Vehicle ID</label>
                <Input name="vehicleId" placeholder="Enter Vehicle ID" required />
              </div>
              <div>
                <label className="text-sm font-medium">IMEI Number</label>
                <Input 
                  name="imei" 
                  placeholder="Enter 15-digit IMEI"
                  pattern="[0-9]{15}"
                  title="IMEI must be 15 digits"
                  required 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Vehicle Model</label>
                <Input name="model" placeholder="Enter Vehicle Model" required />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Add Vehicle</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddVehicle(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Route Modal */}
    {showRouteModal && selectedVehicle && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[500px]">
          <CardHeader>
            <CardTitle>Update Route - {selectedVehicle.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Start Point</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  defaultValue={selectedVehicle.route?.start || ''}
                  onChange={(e) => handleRouteUpdate(selectedVehicle.id, {
                    ...selectedVehicle.route,
                    start: e.target.value
                  })}
                >
                  <option value="">Select Start Point</option>
                  {points.map((point) => (
                    <option key={point.name} value={point.name}>
                      {point.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">End Point</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  defaultValue={selectedVehicle.route?.end || ''}
                  onChange={(e) => handleRouteUpdate(selectedVehicle.id, {
                    ...selectedVehicle.route,
                    end: e.target.value
                  })}
                >
                  <option value="">Select End Point</option>
                  {points.map((point) => (
                    <option key={point.name} value={point.name}>
                      {point.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowRouteModal(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Expense Modal */}
    {showExpenseModal && selectedVehicle && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[500px]">
          <CardHeader>
            <CardTitle>Update Expenses - {selectedVehicle.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(selectedVehicle.expenses || {}).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="number"
                      defaultValue={value}
                      className="pl-10"
                      onChange={(e) => {
                        const expenses = {
                          ...selectedVehicle.expenses,
                          [key]: parseFloat(e.target.value) || 0
                        };
                        handleExpenseUpdate(selectedVehicle.id, expenses);
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button onClick={() => setShowExpenseModal(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);
};

export default FleetPreview;
