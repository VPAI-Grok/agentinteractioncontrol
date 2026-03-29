import assert from "node:assert/strict";

export function createReferenceConsumer(bundle) {
  function getElement(id) {
    const element = bundle.ui.elements.find((candidate) => candidate.id === id);
    assert.ok(element, `expected runtime UI element ${id}`);
    return element;
  }

  function getEndpoint(kind) {
    const endpoint = bundle.discovery.endpoints?.[kind];
    assert.equal(typeof endpoint, "string", `expected discovery endpoint for ${kind}`);
    return endpoint;
  }

  function getActionContract(id) {
    const contract = bundle.actions.actions.find((candidate) => candidate.target === id);
    assert.ok(contract, `expected action contract for ${id}`);
    return contract;
  }

  function getPermissionPolicy(id) {
    const element = getElement(id);
    const explicitPolicy = bundle.permissions.actionPolicies?.[id];

    if (explicitPolicy) {
      return {
        policy: explicitPolicy,
        source: "action_policy"
      };
    }

    return {
      policy: bundle.permissions.riskBands[element.risk],
      source: "risk_band"
    };
  }

  function resolveWorkflow(id) {
    const element = getElement(id);
    assert.equal(typeof element.workflow_ref, "string", `expected workflow_ref for ${id}`);

    for (const workflow of bundle.workflows.workflows) {
      if (workflow.id === element.workflow_ref) {
        return {
          step: undefined,
          workflow
        };
      }

      const step = workflow.steps.find((candidate) => candidate.id === element.workflow_ref);
      if (step) {
        return {
          step,
          workflow
        };
      }
    }

    assert.fail(`expected workflow for ${id} via ${element.workflow_ref}`);
  }

  function requiresConfirmation(id) {
    const element = getElement(id);
    if (element.requires_confirmation === true || element.confirmation) {
      return true;
    }

    const resolved = getPermissionPolicy(id);
    return resolved.policy?.requiresConfirmation === true;
  }

  function getCompletionStrategy(id) {
    const element = getElement(id);

    if (Array.isArray(element.execution?.settled_when) && element.execution.settled_when.length > 0) {
      return {
        conditions: element.execution.settled_when,
        mode: "settled_when",
        source: "runtime_execution"
      };
    }

    if (Array.isArray(element.execution?.ready_when) && element.execution.ready_when.length > 0) {
      return {
        conditions: element.execution.ready_when,
        mode: "ready_when",
        source: "runtime_execution"
      };
    }

    const contract = getActionContract(id);
    return {
      conditions: [contract.completion_signal.value],
      mode: contract.completion_signal.type,
      source: "action_contract"
    };
  }

  function findElementsByEntityRef(entityType, entityId) {
    return bundle.ui.elements.filter(
      (element) =>
        element.entity_ref?.entity_type === entityType && element.entity_ref?.entity_id === entityId
    );
  }

  return {
    findElementsByEntityRef,
    getActionContract,
    getCompletionStrategy,
    getElement,
    getEndpoint,
    getPermissionPolicy,
    requiresConfirmation,
    resolveWorkflow
  };
}
