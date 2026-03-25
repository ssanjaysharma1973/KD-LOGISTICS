import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
//import RoutePlanner from './RoutePlanner';

jest.mock('./Source/trackingService.js', () => ({
  initialize: jest.fn(),
  cleanup: jest.fn(),
}));

jest.mock('./utils/routeOptimizer.js', () => jest.fn(() => Promise.resolve([])));

beforeEach(() => {
  global.window.MapmyIndia = {
    Map: jest.fn(() => ({
      remove: jest.fn(),
      flyTo: jest.fn(),
    })),
    Marker: jest.fn(() => ({
      addTo: jest.fn(),
    })),
    Circle: jest.fn(),
  };

  global.fetch = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the Route Planner heading', () => {
  render(<RoutePlanner />);
  expect(screen.getByText(/Route Planner/i)).toBeInTheDocument();
});

test('displays alerts when fetching fails', async () => {
  global.fetch.mockImplementation(() =>
    Promise.reject(new Error('Fetch failed'))
  );

  render(<RoutePlanner />);

  await waitFor(() => {
    expect(
      screen.getByText(/Failed to fetch locations and vehicles/i)
    ).toBeInTheDocument();
  });
});

test('handles route generation', async () => {
  const mockVehicles = [
    {
      id: 1,
      vehicleNo: 'MH-12-AB-1234',
      driverName: 'John Doe',
      status: 'active',
      position: [28.6139, 77.2090],
      constraints: {},
      destinations: [],
    },
  ];

  global.fetch.mockImplementation((url) => {
    if (url.includes('/api/vehicles')) {
      return Promise.resolve({
        json: () => Promise.resolve(mockVehicles),
      });
    }
    return Promise.resolve({
      json: () => Promise.resolve({ warehouses: [], factories: [], distributors: [] }),
    });
  });

  render(<RoutePlanner />);

  await waitFor(() => {
    expect(screen.getByText(/MH-12-AB-1234/i)).toBeInTheDocument();
  });

  const vehicleElement = screen.getByText(/MH-12-AB-1234/i);
  vehicleElement.click();

  await waitFor(() => {
    const generateRouteButton = screen.getByRole('button', { name: /Generate Route/i });
    expect(generateRouteButton).not.toBeDisabled();
  });
});
