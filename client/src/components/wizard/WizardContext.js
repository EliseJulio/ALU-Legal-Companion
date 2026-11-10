import { createContext, useContext } from 'react';

// The messages for the step on screen, keyed by the id of the field they belong to. A field reads
// its own message here, so a step's fields need no prop for it.
const WizardContext = createContext({});

export const WizardContextProvider = WizardContext.Provider;

export function useWizardErrors() {
  return useContext(WizardContext);
}
