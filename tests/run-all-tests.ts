/**
 * MASTER ENTERPRISE TEST RUNNER
 * Executes all 4 testing tiers:
 * 1. Unit Tests
 * 2. Integration Tests
 * 3. End-to-End (E2E) Tests
 * 4. Performance & Concurrency Benchmarks
 */

import { pickupInvariantsSuite } from './unit/pickup-invariants.test';
import { escortDomainSuite } from './unit/escort-domain.test';
import { routesVehiclesUnitSuite } from './unit/routes-vehicles.test';
import { visitorDomainUnitSuite } from './unit/visitor-domain.test';
import { photoResolutionUnitSuite } from './unit/photo-resolution.test';
import { escortRecordsDomainSuite } from './unit/escort-records-domain.test';
import { safetyConnectDomainSuite } from './unit/safety-connect-domain.test';
import { parentBookingWorkflowDomainSuite } from './unit/parent-booking-workflow.test';
import { pickupAuthorizationDomainSuite } from './unit/pickup-authorization-domain.test';
import { emergencyDeputisingDomainSuite } from './unit/emergency-deputising-domain.test';
import { pickupControlApiSuite } from './integration/pickup-control-api.test';
import { escortApisSuite } from './integration/escort-apis.test';
import { routesVehiclesApiSuite } from './integration/routes-vehicles-api.test';
import { gateVisitorsApiSuite } from './integration/gate-visitors-api.test';
import { photoSyncApiSuite } from './integration/photo-sync-api.test';
import { escortRecordsApiSuite } from './integration/escort-records-api.test';
import { safetyConnectApiSuite } from './integration/safety-connect-api.test';
import { parentBookingWorkflowApiSuite } from './integration/parent-booking-workflow-api.test';
import { pickupAuthorizationApiSuite } from './integration/pickup-authorization-api.test';
import { emergencyDeputisingApiSuite } from './integration/emergency-deputising-api.test';
import { centralPickupE2ESuite } from './e2e/central-pickup-e2e.test';
import { routeManagementE2ESuite } from './e2e/route-management-e2e.test';
import { gateVisitorsE2ESuite } from './e2e/gate-visitors-e2e.test';
import { staffPhotoLifecycleE2ESuite } from './e2e/staff-photo-lifecycle-e2e.test';
import { escortRecordsE2ESuite } from './e2e/escort-records-e2e.test';
import { safetyConnectE2ESuite } from './e2e/safety-connect-e2e.test';
import { parentBookingWorkflowE2ESuite } from './e2e/parent-booking-workflow-e2e.test';
import { pickupAuthorizationE2ESuite } from './e2e/pickup-authorization-e2e.test';
import { emergencyDeputisingE2ESuite } from './e2e/emergency-deputising-e2e.test';
import { performanceSuite } from './performance/api-benchmarks.test';
import { routesPerfSuite } from './performance/routes-perf.test';
import { gateVisitorsPerfSuite } from './performance/gate-visitors-perf.test';
import { photoPerfSuite } from './performance/photo-perf.test';
import { escortRecordsPerfSuite } from './performance/escort-records-perf.test';
import { safetyConnectPerfSuite } from './performance/safety-connect-perf.test';
import { parentBookingPerfSuite } from './performance/parent-booking-perf.test';
import { pickupAuthorizationPerfSuite } from './performance/pickup-authorization-perf.test';
import { emergencyDeputisingPerfSuite } from './performance/emergency-deputising-perf.test';
import { TestResult } from './utils/test-harness';

async function runAllTests() {
  console.log('\n\x1b[1m\x1b[36m================================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m    MYEDURIDE ENTERPRISE TEST SUITE: 4-TIER MULTI-FORMAT VALIDATION           \x1b[0m');
  console.log('\x1b[1m\x1b[36m    [1] Unit  •  [2] Integration  •  [3] End-to-End (E2E)  •  [4] Performance   \x1b[0m');
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');

  const allSuites = [
    pickupInvariantsSuite,
    escortDomainSuite,
    routesVehiclesUnitSuite,
    visitorDomainUnitSuite,
    photoResolutionUnitSuite,
    escortRecordsDomainSuite,
    safetyConnectDomainSuite,
    parentBookingWorkflowDomainSuite,
    pickupAuthorizationDomainSuite,
    emergencyDeputisingDomainSuite,
    pickupControlApiSuite,
    escortApisSuite,
    routesVehiclesApiSuite,
    gateVisitorsApiSuite,
    photoSyncApiSuite,
    escortRecordsApiSuite,
    safetyConnectApiSuite,
    parentBookingWorkflowApiSuite,
    pickupAuthorizationApiSuite,
    emergencyDeputisingApiSuite,
    centralPickupE2ESuite,
    routeManagementE2ESuite,
    gateVisitorsE2ESuite,
    staffPhotoLifecycleE2ESuite,
    escortRecordsE2ESuite,
    safetyConnectE2ESuite,
    parentBookingWorkflowE2ESuite,
    pickupAuthorizationE2ESuite,
    emergencyDeputisingE2ESuite,
    performanceSuite,
    routesPerfSuite,
    gateVisitorsPerfSuite,
    photoPerfSuite,
    escortRecordsPerfSuite,
    safetyConnectPerfSuite,
    parentBookingPerfSuite,
    pickupAuthorizationPerfSuite,
    emergencyDeputisingPerfSuite,
  ];

  const overallResults: TestResult[] = [];
  const startTime = performance.now();

  for (const suite of allSuites) {
    console.log(`\x1b[1m\x1b[33m▶ Running Suite: ${suite.suiteName} (${suite.category})\x1b[0m`);
    const results = await suite.run();
    overallResults.push(...results);
    suite.printSummary();
  }

  const totalDuration = (performance.now() - startTime).toFixed(2);
  const totalTests = overallResults.length;
  const passedTests = overallResults.filter((r) => r.passed).length;
  const failedTests = overallResults.filter((r) => !r.passed).length;

  // Breakdown by category
  const categories = ['UNIT', 'INTEGRATION', 'E2E', 'PERFORMANCE'] as const;

  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[37m                          FINAL TEST EXECUTION SUMMARY                          \x1b[0m');
  console.log('\x1b[1m\x1b[36m================================================================================\x1b[0m\n');

  for (const cat of categories) {
    const catTests = overallResults.filter((r) => r.category === cat);
    const catPassed = catTests.filter((r) => r.passed).length;
    const catFailed = catTests.filter((r) => !r.passed).length;
    const catTime = catTests.reduce((acc, r) => acc + r.durationMs, 0).toFixed(2);
    const statusIcon = catFailed === 0 ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';

    console.log(`  ${statusIcon} \x1b[1mTier ${cat.padEnd(12)}\x1b[0m: ${catPassed}/${catTests.length} Passed (${catTime}ms)`);
  }

  console.log('\n\x1b[1m--------------------------------------------------------------------------------\x1b[0m');
  if (failedTests === 0) {
    console.log(`  \x1b[1m\x1b[32mALL ${totalTests} TESTS PASSED SUCCESSFULLY across all 4 formats in ${totalDuration}ms!\x1b[0m`);
  } else {
    console.log(`  \x1b[1m\x1b[31m${failedTests} OUT OF ${totalTests} TESTS FAILED. Please review the trace logs above.\x1b[0m`);
  }
  console.log('\x1b[1m--------------------------------------------------------------------------------\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
