import SipCalculator from './Sip';
import LumpSumCalculator from './LumpSum';
import StepUpCalculator from './StepUp';
import GoalCalculator from './Goal';
import RetirementCalculator from './Retirement';
import SwpCalculator from './Swp';
import ElssCalculator from './Elss';
import CostOfDelayCalculator from './CostOfDelay';

/** Calculator registry keyed by URL id (/calculators/:kind and service `calculators` array). */
export const CALCULATORS = [
  { id: 'sip', label: 'SIP', title: 'SIP calculator', icon: 'repeat', short: 'See how a monthly SIP could grow over time.', Component: SipCalculator },
  { id: 'lump-sum', label: 'Lump sum', title: 'Lump sum calculator', icon: 'rupee', short: 'Estimate the value of a one-time investment.', Component: LumpSumCalculator },
  { id: 'step-up-sip', label: 'Step-up SIP', title: 'Step-up SIP calculator', icon: 'chart', short: 'Compare a SIP that rises every year with a flat SIP.', Component: StepUpCalculator },
  { id: 'goal', label: 'Goal', title: 'Goal calculator', icon: 'target', short: 'Future cost of a goal and the SIP or lump sum it may need.', Component: GoalCalculator },
  { id: 'retirement', label: 'Retirement', title: 'Retirement calculator', icon: 'sun', short: 'Corpus you may need and the monthly SIP to build it.', Component: RetirementCalculator },
  { id: 'swp', label: 'SWP', title: 'SWP calculator', icon: 'layers', short: 'Plan regular withdrawals and see how long a corpus may last.', Component: SwpCalculator },
  { id: 'elss', label: 'ELSS tax', title: 'ELSS tax saving calculator', icon: 'shield', short: 'Estimate tax saved under Section 80C (old regime).', Component: ElssCalculator },
  { id: 'cost-of-delay', label: 'Cost of delay', title: 'Cost of delay calculator', icon: 'clock', short: 'What waiting a few months to start a SIP could cost.', Component: CostOfDelayCalculator },
];

export const calculatorById = (id) => CALCULATORS.find((c) => c.id === id);
