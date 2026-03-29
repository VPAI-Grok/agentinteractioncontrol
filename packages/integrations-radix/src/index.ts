import type { AICMetadataProps } from "@aic/sdk-react";

export interface RadixAICOptions {
  description?: string;
  entityId?: string;
  entityType?: string;
  id: string;
  risk?: AICMetadataProps["agentRisk"];
}

export function createRadixDialogTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "click",
    agentDescription: options.description ?? "Opens a dialog",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "dialog_trigger"
  };
}

export function createRadixDialogContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "read",
    agentDescription: options.description ?? "Reads dialog contents",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "dialog"
  };
}

export function createRadixSelectAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    ...createRadixSelectTriggerAICProps(options),
    agentRole: "select"
  };
}

export function createRadixSelectTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "select",
    agentDescription: options.description ?? "Opens a selection menu",
    agentEntityId: options.entityId,
    agentEntityType: options.entityType,
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "combobox"
  };
}

export function createRadixSelectItemAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "select",
    agentDescription: options.description ?? "Selects an option",
    agentEntityId: options.entityId,
    agentEntityType: options.entityType,
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "option"
  };
}

export function createRadixMenuItemAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "click",
    agentDescription: options.description ?? "Runs a menu action",
    agentEntityId: options.entityId,
    agentEntityType: options.entityType,
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "menuitem"
  };
}

export function createRadixCheckboxAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "toggle",
    agentDescription: options.description ?? "Toggles a checkbox",
    agentEntityId: options.entityId,
    agentEntityType: options.entityType,
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "checkbox"
  };
}

export function createRadixSwitchAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "toggle",
    agentDescription: options.description ?? "Toggles a switch",
    agentEntityId: options.entityId,
    agentEntityType: options.entityType,
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "switch"
  };
}

export function createRadixTabsTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "select",
    agentDescription: options.description ?? "Switches to a tab",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "tab"
  };
}

export function createRadixTabsContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    agentAction: "read",
    agentDescription: options.description ?? "Reads tab content",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "tabpanel"
  };
}
