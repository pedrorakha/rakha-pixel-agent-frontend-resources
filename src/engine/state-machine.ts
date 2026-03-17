import { CharacterState } from "@/types/character";

export interface StateTransition {
  from: CharacterState;
  to: CharacterState;
  condition?: () => boolean;
}

export interface StateConfig {
  onEnter?: () => void;
  onUpdate?: (deltaTime: number) => void;
  onExit?: () => void;
}

export class StateMachine {
  private currentState: CharacterState;
  private states: Map<CharacterState, StateConfig> = new Map();
  private transitions: StateTransition[] = [];

  constructor(initialState: CharacterState) {
    this.currentState = initialState;
  }

  addState(state: CharacterState, config: StateConfig): void {
    this.states.set(state, config);
  }

  addTransition(transition: StateTransition): void {
    this.transitions.push(transition);
  }

  getCurrentState(): CharacterState {
    return this.currentState;
  }

  setState(newState: CharacterState): void {
    if (newState === this.currentState) return;

    const currentConfig = this.states.get(this.currentState);
    if (currentConfig?.onExit) {
      currentConfig.onExit();
    }

    this.currentState = newState;

    const newConfig = this.states.get(newState);
    if (newConfig?.onEnter) {
      newConfig.onEnter();
    }
  }

  update(deltaTime: number): void {
    // Check transitions
    for (const transition of this.transitions) {
      if (
        transition.from === this.currentState &&
        transition.condition &&
        transition.condition()
      ) {
        this.setState(transition.to);
        return;
      }
    }

    // Update current state
    const config = this.states.get(this.currentState);
    if (config?.onUpdate) {
      config.onUpdate(deltaTime);
    }
  }
}

export function createCharacterStateMachine(
  initialState: CharacterState
): StateMachine {
  const sm = new StateMachine(initialState);

  const allStates: CharacterState[] = [
    "typing",
    "focused",
    "drinking_coffee",
    "sleeping",
    "walking",
    "idle",
  ];

  for (const state of allStates) {
    sm.addState(state, {});
  }

  return sm;
}
