// utils/validators.js
export const validateIMEI = (imei) => {
  if (!imei) return false;
  return /^[0-9]{15}$/.test(imei);
};

export const validateVehicleId = (id) => {
  if (!id) return false;
  return /^[A-Z0-9]{2,10}$/.test(id);
};

export const validateLatLng = (lat, lng) => {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  return (
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
};

export const validatePhoneNumber = (phone) => {
  if (!phone) return false;
  return /^[0-9]{10}$/.test(phone);
};

// utils/formatters.js
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// utils/calculations.js
export const calculateRouteDistance = (points) => {
  if (!points || points.length < 2) return 0;
  
  const R = 6371e3; // Earth's radius in meters
  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const φ1 = points[i].lat * Math.PI / 180;
    const φ2 = points[i + 1].lat * Math.PI / 180;
    const Δφ = (points[i + 1].lat - points[i].lat) * Math.PI / 180;
    const Δλ = (points[i + 1].lng - points[i].lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    totalDistance += distance;
  }

  return totalDistance;
};

export const calculateFuelEfficiency = (distanceKm, fuelLiters) => {
  if (!fuelLiters || fuelLiters === 0) return 0;
  return (distanceKm / fuelLiters).toFixed(2);
};

export const calculateTotalExpenses = (expenses) => {
  if (!expenses) return 0;
  return Object.values(expenses).reduce((sum, value) => sum + (value || 0), 0);
};

// utils/statusHelpers.js
export const getVehicleStatusColor = (status) => {
  const statusColors = {
    active: 'green',
    inactive: 'gray',
    maintenance: 'yellow',
    error: 'red'
  };
  return statusColors[status] || 'gray';
};

export const getMaintenanceStatus = (vehicle) => {
  const lastMaintenance = new Date(vehicle.lastMaintenance);
  const daysSinceLastMaintenance = Math.floor(
    (new Date() - lastMaintenance) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastMaintenance > 90) return 'overdue';
  if (daysSinceLastMaintenance > 75) return 'due-soon';
  return 'ok';
};

// utils/mapHelpers.js
export const calculateBounds = (points) => {
  if (!points || points.length === 0) return null;

  const bounds = points.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, parseFloat(point.lat)),
      maxLat: Math.max(acc.maxLat, parseFloat(point.lat)),
      minLng: Math.min(acc.minLng, parseFloat(point.lng)),
      maxLng: Math.max(acc.maxLng, parseFloat(point.lng))
    }),
    {
      minLat: 90,
      maxLat: -90,
      minLng: 180,
      maxLng: -180
    }
  );

  return bounds;
};

export const isPointInBounds = (point, bounds) => {
  if (!point || !bounds) return false;
  
  const lat = parseFloat(point.lat);
  const lng = parseFloat(point.lng);
  
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
};

// utils/dataTransformers.js
export const transformVehicleData = (rawData) => {
  return {
    ...rawData,
    totalExpenses: calculateTotalExpenses(rawData.expenses),
    fuelEfficiency: calculateFuelEfficiency(
      rawData.tripStats?.distanceCovered || 0,
      rawData.tripStats?.fuelConsumed || 0
    ),
    maintenanceStatus: rawData.lastMaintenance 
      ? getMaintenanceStatus({ lastMaintenance: rawData.lastMaintenance })
      : 'unknown'
  };
};

export const groupVehiclesByStatus = (vehicles) => {
  return vehicles.reduce((acc, vehicle) => {
    const status = vehicle.status || 'unknown';
    acc[status] = [...(acc[status] || []), vehicle];
    return acc;
  }, {});
};

// utils/errorHandlers.js
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export const handleApiError = (error) => {
  if (error instanceof ValidationError) {
    return {
      type: 'validation',
      message: error.message,
      field: error.field
    };
  }

  if (error.name === 'NetworkError') {
    return {
      type: 'network',
      message: 'Network connection error. Please check your internet connection.'
    };
  }

  return {
    type: 'general',
    message: 'An unexpected error occurred. Please try again later.'
  };
};

// utils/constants.js
export const VEHICLE_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  ERROR: 'error'
};

export const EXPENSE_TYPES = {
  FUEL: 'fuel',
  MAINTENANCE: 'maintenance',
  SALARY: 'salary',
  TOLL: 'toll',
  OTHER: 'other'
};

export const MAINTENANCE_INTERVALS = {
  OIL_CHANGE: 5000, // km
  TIRE_ROTATION: 10000, // km
  BRAKE_CHECK: 20000, // km
  MAJOR_SERVICE: 40000 // km
};

export const DEFAULT_MAP_CENTER = {
  lat: 20.5937,
  lng: 78.9629
};
// utils/trackingHelpers.js
export const calculateRouteProgress = (currentLocation, routePoints) => {
  if (!currentLocation || !routePoints || routePoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  let coveredDistance = 0;
  const currentPoint = {
    lat: parseFloat(currentLocation.lat),
    lng: parseFloat(currentLocation.lng)
  };

  // Calculate total route distance and distance covered
  for (let i = 0; i < routePoints.length - 1; i++) {
    const segmentDistance = calculateDistance(
      routePoints[i],
      routePoints[i + 1]
    );
    totalDistance += segmentDistance;

    if (i === 0) {
      coveredDistance += calculateDistance(routePoints[0], currentPoint);
    } else if (isPointBetween(currentPoint, routePoints[i], routePoints[i + 1])) {
      coveredDistance += calculateDistance(routePoints[0], routePoints[i]);
      coveredDistance += calculateDistance(routePoints[i], currentPoint);
      break;
    }
  }

  return (coveredDistance / totalDistance) * 100;
};

export const isPointBetween = (point, start, end) => {
  const tolerance = 0.1; // 100 meters tolerance
  
  const d1 = calculateDistance(start, point);
  const d2 = calculateDistance(point, end);
  const lineLength = calculateDistance(start, end);
  
  // Use triangle inequality with tolerance
  return Math.abs(d1 + d2 - lineLength) <= tolerance;
};

export const calculateETA = (
  currentLocation,
  destination,
  averageSpeed,
  stops = []
) => {
  if (!currentLocation || !destination || !averageSpeed) {
    return null;
  }

  const AVERAGE_STOP_TIME = 20; // minutes
  const distance = calculateDistance(currentLocation, destination);
  const timeInHours = distance / averageSpeed;
  const stopTime = stops.length * AVERAGE_STOP_TIME / 60;

  const totalHours = timeInHours + stopTime;
  const now = new Date();
  return new Date(now.getTime() + totalHours * 60 * 60 * 1000);
};

// utils/geofencingHelpers.js
export const createCircularGeofence = (center, radiusKm) => {
  return {
    type: 'circle',
    center,
    radius: radiusKm * 1000 // Convert to meters
  };
};

export const createPolygonGeofence = (points) => {
  if (!points || points.length < 3) {
    throw new Error('Polygon geofence requires at least 3 points');
  }

  return {
    type: 'polygon',
    points
  };
};

export const isPointInGeofence = (point, geofence) => {
  if (!point || !geofence) return false;

  if (geofence.type === 'circle') {
    const distance = calculateDistance(point, geofence.center);
    return distance <= geofence.radius;
  }

  if (geofence.type === 'polygon') {
    return isPointInPolygon(point, geofence.points);
  }

  return false;
};

export const isPointInPolygon = (point, polygon) => {
  let isInside = false;
  const x = parseFloat(point.lng);
  const y = parseFloat(point.lat);

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = parseFloat(polygon[i].lng);
    const yi = parseFloat(polygon[i].lat);
    const xj = parseFloat(polygon[j].lng);
    const yj = parseFloat(polygon[j].lat);

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }

  return isInside;
};

// utils/alertHelpers.js
export const checkGeofenceViolation = (vehicle, geofences) => {
  if (!vehicle.currentLocation || !geofences) return false;

  for (const geofence of geofences) {
    const isInside = isPointInGeofence(vehicle.currentLocation, geofence);
    
    if (geofence.type === 'restricted' && isInside) {
      return {
        type: 'geofence_violation',
        message: `Vehicle ${vehicle.id} has entered restricted zone: ${geofence.name}`,
        severity: 'high',
        timestamp: new Date().toISOString()
      };
    }
    
    if (geofence.type === 'required' && !isInside) {
      return {
        type: 'geofence_violation',
        message: `Vehicle ${vehicle.id} has left required zone: ${geofence.name}`,
        severity: 'medium',
        timestamp: new Date().toISOString()
      };
    }
  }

  return null;
};

export const checkSpeedViolation = (vehicle, speedLimit) => {
  if (!vehicle.obd?.speed || !speedLimit) return null;

  if (vehicle.obd.speed > speedLimit) {
    return {
      type: 'speed_violation',
      message: `Vehicle ${vehicle.id} exceeded speed limit: ${vehicle.obd.speed} km/h`,
      severity: 'high',
      timestamp: new Date().toISOString()
    };
  }

  return null;
};

// utils/trackingConstants.js
export const TRACKING_UPDATE_INTERVAL = 10000; // 10 seconds
export const DEFAULT_SPEED_LIMIT = 80; // km/h
export const GEOFENCE_TYPES = {
  RESTRICTED: 'restricted',
  REQUIRED: 'required',
  NOTIFICATION: 'notification'
};

export const ALERT_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const TRACKING_MODES = {
  REALTIME: 'realtime',
  HISTORY: 'history',
  PREDICTIVE: 'predictive'
};
// utils/analyticsHelpers.js
import _ from 'lodash';

// Vehicle Performance Analytics
export const calculateFleetMetrics = (vehicles) => {
  if (!vehicles || vehicles.length === 0) return null;

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  
  return {
    totalVehicles: vehicles.length,
    activeVehicles: activeVehicles.length,
    utilizationRate: (activeVehicles.length / vehicles.length) * 100,
    averageSpeed: calculateAverageSpeed(activeVehicles),
    totalFuelConsumption: calculateTotalFuelConsumption(vehicles),
    averageFuelEfficiency: calculateAverageFuelEfficiency(vehicles),
    maintenanceStatus: analyzeMaintenanceStatus(vehicles),
    totalExpenses: calculateTotalFleetExpenses(vehicles)
  };
};

export const calculateVehicleEfficiencyMetrics = (vehicle, timeRange) => {
  if (!vehicle || !vehicle.tripData) return null;

  const relevantTrips = filterTripsByTimeRange(vehicle.tripData, timeRange);
  
  return {
    totalDistance: calculateTotalDistance(relevantTrips),
    fuelEfficiency: calculateFuelEfficiency(relevantTrips),
    idleTime: calculateTotalIdleTime(relevantTrips),
    harshBraking: countHarshBrakingEvents(relevantTrips),
    speedingEvents: countSpeedingEvents(relevantTrips),
    averageSpeed: calculateAverageTripSpeed(relevantTrips)
  };
};

// Financial Analytics
export const calculateFinancialMetrics = (vehicles, timeRange) => {
  const expenses = aggregateExpensesByCategory(vehicles, timeRange);
  const revenue = calculateTotalRevenue(vehicles, timeRange);
  
  return {
    totalRevenue: revenue,
    totalExpenses: calculateTotalExpenses(expenses),
    netProfit: revenue - calculateTotalExpenses(expenses),
    expenseBreakdown: calculateExpensePercentages(expenses),
    costPerKilometer: calculateCostPerKilometer(vehicles, timeRange),
    revenuePerKilometer: calculateRevenuePerKilometer(vehicles, timeRange)
  };
};

export const generateROIAnalysis = (vehicle, timeRange) => {
  const income = calculateVehicleIncome(vehicle, timeRange);
  const expenses = calculateVehicleExpenses(vehicle, timeRange);
  const initialInvestment = vehicle.purchasePrice || 0;
  
  return {
    roi: ((income - expenses) / initialInvestment) * 100,
    paybackPeriod: calculatePaybackPeriod(initialInvestment, income - expenses),
    profitMargin: ((income - expenses) / income) * 100,
    breakevenAnalysis: calculateBreakeven(vehicle)
  };
};

// Route Analytics
export const analyzeRouteEfficiency = (vehicles, routes) => {
  return routes.map(route => ({
    routeId: route.id,
    averageCompletionTime: calculateAverageCompletionTime(vehicles, route),
    delayFrequency: calculateDelayFrequency(vehicles, route),
    fuelEfficiency: calculateRouteFuelEfficiency(vehicles, route),
    stopTimeAnalysis: analyzeStopTimes(vehicles, route),
    trafficPatterns: analyzeTrafficPatterns(vehicles, route)
  }));
};

export const generateRouteOptimizationSuggestions = (route, historicalData) => {
  return {
    alternativeRoutes: findAlternativeRoutes(route, historicalData),
    optimizedStops: optimizeStopSequence(route),
    timeWindowSuggestions: suggestOptimalTimeWindows(route, historicalData),
    loadingPointRecommendations: recommendLoadingPoints(route)
  };
};

// Maintenance Analytics
export const generateMaintenanceReport = (vehicles, timeRange) => {
  const maintenanceData = aggregateMaintenanceData(vehicles, timeRange);
  
  return {
    totalMaintenanceCost: calculateTotalMaintenanceCost(maintenanceData),
    maintenanceFrequency: calculateMaintenanceFrequency(maintenanceData),
    commonIssues: identifyCommonIssues(maintenanceData),
    predictiveMaintenance: generatePredictiveMaintenance(vehicles),
    costPerVehicle: calculateMaintenanceCostPerVehicle(maintenanceData),
    maintenanceEfficiency: assessMaintenanceEfficiency(maintenanceData)
  };
};

// Driver Analytics
export const analyzeDriverPerformance = (drivers, timeRange) => {
  return drivers.map(driver => ({
    driverId: driver.id,
    safetyScore: calculateDriverSafetyScore(driver, timeRange),
    fuelEfficiency: calculateDriverFuelEfficiency(driver, timeRange),
    routeAdherence: calculateRouteAdherence(driver, timeRange),
    deliveryPerformance: analyzeDeliveryPerformance(driver, timeRange),
    restCompliance: checkRestCompliance(driver, timeRange)
  }));
};

// Helper Functions
const calculateAverageSpeed = (vehicles) => {
  if (!vehicles.length) return 0;
  const speeds = vehicles.map(v => v.obd?.speed || 0);
  return _.mean(speeds);
};

const calculateTotalFuelConsumption = (vehicles) => {
  return vehicles.reduce((total, vehicle) => {
    const fuelConsumed = vehicle.tripStats?.fuelConsumed || 0;
    return total + fuelConsumed;
  }, 0);
};

const calculateAverageFuelEfficiency = (vehicles) => {
  const efficiencies = vehicles.map(vehicle => {
    const distance = vehicle.tripStats?.distanceCovered || 0;
    const fuel = vehicle.tripStats?.fuelConsumed || 0;
    return fuel > 0 ? distance / fuel : 0;
  });
  return _.mean(efficiencies);
};

const analyzeMaintenanceStatus = (vehicles) => {
  const statuses = vehicles.map(vehicle => getMaintenanceStatus(vehicle));
  return {
    ok: statuses.filter(s => s === 'ok').length,
    dueSoon: statuses.filter(s => s === 'due-soon').length,
    overdue: statuses.filter(s => s === 'overdue').length
  };
};

const calculateTotalFleetExpenses = (vehicles) => {
  return vehicles.reduce((total, vehicle) => {
    const expenses = Object.values(vehicle.expenses || {});
    return total + expenses.reduce((sum, exp) => sum + (exp || 0), 0);
  }, 0);
};

const filterTripsByTimeRange = (trips, timeRange) => {
  const { start, end } = timeRange;
  return trips.filter(trip => {
    const tripDate = new Date(trip.timestamp);
    return tripDate >= start && tripDate <= end;
  });
};

const calculateTotalDistance = (trips) => {
  return trips.reduce((total, trip) => total + (trip.distance || 0), 0);
};

const calculateTotalIdleTime = (trips) => {
  return trips.reduce((total, trip) => total + (trip.idleTime || 0), 0);
};

const countHarshBrakingEvents = (trips) => {
  return trips.reduce((count, trip) => count + (trip.harshBrakingCount || 0), 0);
};

const countSpeedingEvents = (trips) => {
  return trips.reduce((count, trip) => count + (trip.speedingCount || 0), 0);
};

const calculateAverageTripSpeed = (trips) => {
  if (!trips.length) return 0;
  const speeds = trips.map(trip => trip.averageSpeed || 0);
  return _.mean(speeds);
};

const calculatePaybackPeriod = (investment, monthlyProfit) => {
  if (monthlyProfit <= 0) return Infinity;
  return investment / monthlyProfit;
};

const calculateBreakeven = (vehicle) => {
  const monthlyFixed = calculateMonthlyFixedCosts(vehicle);
  const variableCostPerKm = calculateVariableCostPerKm(vehicle);
  const revenuePerKm = calculateRevenuePerKm(vehicle);
  
  if (revenuePerKm <= variableCostPerKm) return null;
  
  const breakevenKm = monthlyFixed / (revenuePerKm - variableCostPerKm);
  return {
    breakevenKm,
    breakevenRevenue: breakevenKm * revenuePerKm,
    marginOfSafety: ((vehicle.averageMonthlyKm - breakevenKm) / vehicle.averageMonthlyKm) * 100
  };
};

// Export report generation functions
export const generateDailyReport = (vehicles, date) => {
  return {
    date,
    fleetMetrics: calculateFleetMetrics(vehicles),
    activeVehicles: vehicles.filter(v => v.status === 'active').length,
    totalDistance: calculateTotalFleetDistance(vehicles, date),
    fuelConsumption: calculateTotalFuelConsumption(vehicles),
    alerts: generateDailyAlerts(vehicles, date),
    expenses: calculateDailyExpenses(vehicles, date)
  };
};

export const generateMonthlyReport = (vehicles, month, year) => {
  const monthData = filterDataByMonth(vehicles, month, year);
  return {
    period: `${month}/${year}`,
    summary: calculateMonthlyMetrics(monthData),
    trends: analyzeMonthlyTrends(monthData),
    performance: generatePerformanceReport(monthData),
    maintenance: generateMaintenanceReport(monthData),
    finances: generateFinancialReport(monthData)
  };
};

// Export data formatting helpers
export const formatReportData = (data, format = 'json') => {
  switch (format.toLowerCase()) {
    case 'csv':
      return convertToCSV(data);
    case 'pdf':
      return formatForPDF(data);
    case 'excel':
      return formatForExcel(data);
    default:
      return data;
  }
};

export const generateReportFileName = (reportType, period) => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `fleet_${reportType}_report_${period}_${timestamp}`;
};
// utils/emailReports.js
import _ from 'lodash';

const EMAIL_TEMPLATES = {
  daily: {
    subject: 'Daily Fleet Management Report - {date}',
    template: `
      <h1>Daily Fleet Management Report</h1>
      <p>Date: {date}</p>
      
      <h2>Fleet Overview</h2>
      <ul>
        <li>Total Vehicles: {totalVehicles}</li>
        <li>Active Vehicles: {activeVehicles}</li>
        <li>Utilization Rate: {utilizationRate}%</li>
      </ul>

      <h2>Key Metrics</h2>
      <ul>
        <li>Total Distance: {totalDistance} km</li>
        <li>Fuel Consumption: {fuelConsumption} L</li>
        <li>Average Speed: {averageSpeed} km/h</li>
      </ul>

      <h2>Alerts</h2>
      {alertsTable}

      <h2>Expenses</h2>
      {expensesTable}
    `
  },
  weekly: {
    subject: 'Weekly Fleet Performance Report - Week {weekNumber}',
    template: `
      <h1>Weekly Fleet Performance Report</h1>
      <p>Week: {weekNumber}</p>
      <p>Period: {startDate} - {endDate}</p>

      <h2>Performance Summary</h2>
      {performanceSummary}

      <h2>Maintenance Overview</h2>
      {maintenanceTable}

      <h2>Efficiency Metrics</h2>
      {efficiencyMetrics}

      <h2>Weekly Expenses</h2>
      {expensesBreakdown}
    `
  },
  monthly: {
    subject: 'Monthly Fleet Analytics Report - {month} {year}',
    template: `
      <h1>Monthly Fleet Analytics Report</h1>
      <p>Month: {month} {year}</p>

      <h2>Executive Summary</h2>
      {executiveSummary}

      <h2>Detailed Analysis</h2>
      {detailedAnalysis}

      <h2>Trends</h2>
      {trendsAnalysis}

      <h2>Recommendations</h2>
      {recommendations}
    `
  }
};

// Table Generation Functions
const generateAlertsTable = (alerts) => {
  if (!alerts || alerts.length === 0) return '<p>No alerts for this period.</p>';

  return `
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th>Priority</th>
          <th>Type</th>
          <th>Description</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${alerts.map(alert => `
          <tr>
            <td style="color: ${getPriorityColor(alert.priority)}">${alert.priority}</td>
            <td>${alert.type}</td>
            <td>${alert.description}</td>
            <td>${alert.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

const generateExpensesTable = (expenses) => {
  if (!expenses || Object.keys(expenses).length === 0) {
    return '<p>No expenses recorded for this period.</p>';
  }

  const total = Object.values(expenses).reduce((sum, exp) => sum + exp, 0);

  return `
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th>Category</th>
          <th>Amount</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(expenses).map(([category, amount]) => `
          <tr>
            <td>${formatCategory(category)}</td>
            <td style="text-align: right">${formatCurrency(amount)}</td>
            <td style="text-align: right">${formatPercentage((amount / total) * 100)}</td>
          </tr>
        `).join('')}
        <tr style="font-weight: bold; background-color: #f8f9fa;">
          <td>Total</td>
          <td style="text-align: right">${formatCurrency(total)}</td>
          <td style="text-align: right">100%</td>
        </tr>
      </tbody>
    </table>
  `;
};

const generatePerformanceSummary = (performance) => {
  return `
    <div style="margin-bottom: 20px;">
      <h3>Efficiency Metrics</h3>
      <ul>
        <li>Fleet Utilization: ${formatPercentage(performance.utilization)}</li>
        <li>On-Time Deliveries: ${formatPercentage(performance.onTimeDeliveries)}</li>
        <li>Average Fuel Efficiency: ${performance.fuelEfficiency.toFixed(2)} km/L</li>
      </ul>

      <h3>Safety Statistics</h3>
      <ul>
        <li>Safety Score: ${performance.safetyScore}/100</li>
        <li>Incidents Reported: ${performance.incidents}</li>
        <li>Compliance Rate: ${formatPercentage(performance.complianceRate)}</li>
      </ul>
    </div>
  `;
};

const generateMaintenanceTable = (maintenance) => {
  if (!maintenance || maintenance.length === 0) {
    return '<p>No maintenance activities recorded for this period.</p>';
  }

  return `
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th>Vehicle ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Cost</th>
          <th>Next Due</th>
        </tr>
      </thead>
      <tbody>
        ${maintenance.map(item => `
          <tr>
            <td>${item.vehicleId}</td>
            <td>${item.type}</td>
            <td style="color: ${getStatusColor(item.status)}">${item.status}</td>
            <td style="text-align: right">${formatCurrency(item.cost)}</td>
            <td>${formatDate(item.nextDue)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

// Helper Functions
const getPriorityColor = (priority) => {
  const colors = {
    high: '#dc3545',
    medium: '#ffc107',
    low: '#28a745'
  };
  return colors[priority.toLowerCase()] || '#6c757d';
};

const getStatusColor = (status) => {
  const colors = {
    completed: '#28a745',
    pending: '#ffc107',
    overdue: '#dc3545',
    scheduled: '#17a2b8'
  };
  return colors[status.toLowerCase()] || '#6c757d';
};

const formatCategory = (category) => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercentage = (value) => {
  return `${value.toFixed(1)}%`;
};

// Export Functions
export const generateEmailReport = async (data, type = 'daily', options = {}) => {
  const template = EMAIL_TEMPLATES[type];
  if (!template) throw new Error(`Invalid email report type: ${type}`);

  const emailContent = await generateEmailContent(data, template, options);
  const subject = generateEmailSubject(template.subject, options);

  return {
    subject,
    content: emailContent,
    attachments: await generateAttachments(data, type, options)
  };
};

export const generateEmailContent = async (data, template, options) => {
  let content = template.template;

  // Replace placeholders with actual data
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    if (typeof value === 'object') {
      content = content.replace(placeholder, generateDynamicSection(key, value));
    } else {
      content = content.replace(placeholder, value.toString());
    }
  });

  return content;
};

export const generateAttachments = async (data, type, options) => {
  const attachments = [];

  // Add PDF report
  const pdfBuffer = await generatePDFReport(data, type, options);
  attachments.push({
    filename: `fleet_report_${formatDate(new Date())}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf'
  });

  // Add Excel report
  const excelBuffer = await generateExcelReport(data, type, options);
  attachments.push({
    filename: `fleet_report_${formatDate(new Date())}.xlsx`,
    content: excelBuffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  return attachments;
};

const generateEmailSubject = (subjectTemplate, options) => {
  let subject = subjectTemplate;
  Object.entries(options).forEach(([key, value]) => {
    subject = subject.replace(`{${key}}`, value);
  });
  return subject;
};

export const sendEmailReport = async (emailData, recipients) => {
  // Implementation would depend on your email service provider
  // This is just a placeholder structure
  return {
    to: recipients,
    subject: emailData.subject,
    html: emailData.content,
    attachments: emailData.attachments
  };
};