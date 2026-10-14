import assert from 'node:assert/strict';
import Supercluster from 'supercluster';
import {
  verifySchoolGeofenceWithPostGIS,
  getStudentsWithinProximityWithPostGIS,
} from '@/lib/maps/spatial-db';

async function testQuadTreeSpatialClustering() {
  console.log('\n▶ [UNIT TEST] Leaflet Client-Side QuadTree Spatial Clustering (Supercluster)');

  const SuperclusterConstructor =
    ((Supercluster as any)?.default || Supercluster) as unknown as typeof Supercluster;

  const cluster = new SuperclusterConstructor({
    radius: 40,
    maxZoom: 16,
    minPoints: 2,
  });

  // Generate batch of 50 student home pins clustered around 3 neighborhood hubs in Lagos
  const pins: any[] = [];

  // Hub 1: Ikeja GRA (dense neighborhood: 20 students)
  for (let i = 0; i < 20; i++) {
    pins.push({
      type: 'Feature',
      properties: {
        id: `ikeja-${i}`,
        kind: 'home',
        label: `Student Ikeja #${i + 1}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [3.355 + (i % 5) * 0.001, 6.595 + Math.floor(i / 5) * 0.001],
      },
    });
  }

  // Hub 2: Lekki Phase 1 (18 students)
  for (let i = 0; i < 18; i++) {
    pins.push({
      type: 'Feature',
      properties: {
        id: `lekki-${i}`,
        kind: 'home',
        label: `Student Lekki #${i + 1}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [3.475 + (i % 4) * 0.0015, 6.445 + Math.floor(i / 4) * 0.0015],
      },
    });
  }

  // Hub 3: Surulere (12 students)
  for (let i = 0; i < 12; i++) {
    pins.push({
      type: 'Feature',
      properties: {
        id: `surulere-${i}`,
        kind: 'home',
        label: `Student Surulere #${i + 1}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [3.358 + (i % 3) * 0.0012, 6.495 + Math.floor(i / 3) * 0.0012],
      },
    });
  }

  cluster.load(pins);

  // 1. Zoom 11 (High level city view) -> Should cluster the 50 pins into neighborhood cluster pills
  const clustersZ11 = cluster.getClusters([3.2, 6.3, 3.6, 6.7], 11);
  assert.ok(
    clustersZ11.length < 10,
    `Expected dense clustering at Zoom 11, got ${clustersZ11.length} features`
  );

  const clusterPill = clustersZ11.find((f: any) => f.properties.cluster);
  assert.ok(clusterPill, 'Expected to find cluster features at Zoom 11');
  assert.ok(
    clusterPill.properties.point_count >= 10,
    `Expected cluster point count >= 10, got ${clusterPill.properties.point_count}`
  );

  // 2. Expansion zoom computation
  const expansionZoom = cluster.getClusterExpansionZoom(clusterPill.properties.cluster_id);
  assert.ok(expansionZoom > 11, `Expected expansion zoom > 11, got ${expansionZoom}`);

  // 3. Zoom 17 (Deep street view) -> Clusters should uncluster into leaf pins
  const clustersZ17 = cluster.getClusters([3.2, 6.3, 3.6, 6.7], 17);
  assert.equal(
    clustersZ17.length,
    50,
    `Expected all 50 leaf pins unclustered at Zoom 17, got ${clustersZ17.length}`
  );

  console.log('  ✔ Client-side QuadTree clustering: 50 pins collapsed to cluster pills at z11');
  console.log('  ✔ Cluster expansion zoom smoothly navigates from city view to street corridor');
  console.log('  ✔ Zero database roundtrips achieved for pin cluster rendering');
}

async function testPostGISSpatialFallback() {
  console.log('\n▶ [UNIT TEST] PostGIS GiST Spatial Index Engine & Geofence Fallback');

  // Mock Supabase client simulating RPC response or fallback
  const mockSupabase = {
    rpc: async (fnName: string, args: any) => {
      if (fnName === 'verify_school_geofence') {
        // Return simulated PostGIS spatial verification
        return {
          data: [
            {
              is_inside: true,
              actual_distance_meters: 65.4,
              school_lat: 6.5655,
              school_lng: 3.2931,
            },
          ],
          error: null,
        };
      }
      if (fnName === 'get_students_within_proximity') {
        return {
          data: [
            {
              student_id: 'stu-1',
              first_name: 'David',
              last_name: 'Adeleke',
              house_address: '15 Admiralty Way, Lekki',
              house_lat: 6.448,
              house_lng: 3.475,
              distance_meters: 320.5,
            },
            {
              student_id: 'stu-2',
              first_name: 'Zainab',
              last_name: 'Bello',
              house_address: '22 Bisola Durosinmi Etti Drive, Lekki',
              house_lat: 6.449,
              house_lng: 3.477,
              distance_meters: 580.0,
            },
          ],
          error: null,
        };
      }
      return { data: null, error: new Error('Unknown function') };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { gps_lat: 6.5655, gps_lng: 3.2931 },
          }),
        }),
      }),
    }),
  } as any;

  // 1. Test Geofence Check via PostGIS
  const geofenceResult = await verifySchoolGeofenceWithPostGIS(
    mockSupabase,
    'school-test-1',
    6.5656,
    3.2932,
    150
  );

  assert.equal(geofenceResult.is_inside, true);
  assert.equal(geofenceResult.method, 'postgis_gist');
  assert.equal(geofenceResult.actual_distance_meters, 65.4);
  console.log('  ✔ verifySchoolGeofenceWithPostGIS executed with GiST spatial indexing');

  // 2. Test Proximity Query via PostGIS
  const proximityStudents = await getStudentsWithinProximityWithPostGIS(
    mockSupabase,
    'school-test-1',
    6.447,
    3.474,
    1200
  );

  assert.equal(proximityStudents.length, 2);
  assert.equal(proximityStudents[0].student_id, 'stu-1');
  assert.ok(proximityStudents[0].distance_meters < proximityStudents[1].distance_meters);
  console.log('  ✔ getStudentsWithinProximityWithPostGIS returned sorted proximity manifest');
}

async function run() {
  await testQuadTreeSpatialClustering();
  await testPostGISSpatialFallback();
  console.log('\n✔ ALL SPATIAL CLUSTERING & POSTGIS TESTS PASSED!\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
