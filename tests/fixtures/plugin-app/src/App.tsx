import {
  ShadcnAICDialogContent,
  ShadcnAICDialogTrigger,
  ShadcnAICTabsTrigger
} from "@aic/integrations-shadcn";
import { importedAgentId } from "./external";

const agentTokens = {
  archive: {
    action: "click",
    id: "customer.archive",
    risk: "high"
  },
  view: {
    description: "View customer",
    id: `customer.view`
  }
};

const archiveIdAlias = agentTokens.archive.id;
const archiveId = archiveIdAlias;
const archiveRisk = agentTokens.archive.risk;
const withComputedKey = {
  ["badId"]: "customer.computed"
};
const withArgs = (suffix: string) => `customer.${suffix}`;
const dynamicId = Math.random() > 0.5 ? "customer.dynamic_a" : "customer.dynamic_b";

function getViewId() {
  return agentTokens.view.id;
}

const getViewDescription = () => agentTokens.view.description;
const getViewNavigationAction = () => `navigate`;

export function App() {
  return (
    <main>
      <ShadcnAICDialogTrigger
        agentId={archiveId}
        agentDescription="Archive customer"
        agentAction={agentTokens.archive.action}
        agentRisk={archiveRisk}
        agentRole="dialog_trigger"
      >
        Archive customer
      </ShadcnAICDialogTrigger>
      <ShadcnAICDialogContent
        agentId="customer.archive.dialog"
        agentDescription="Archive customer dialog"
        agentAction="read"
        agentRisk="medium"
        agentRole="dialog"
      >
        Review archive impact
      </ShadcnAICDialogContent>
      <ShadcnAICTabsTrigger
        agentId={getViewId()}
        agentDescription={getViewDescription()}
        agentAction="select"
        agentRisk="low"
        agentRole="tab"
      >
        View customer
      </ShadcnAICTabsTrigger>
      <button data-testid="send-renewal">Send renewal email</button>
      <button agentId={importedAgentId} agentDescription="Imported unsupported control">
        Skip imported
      </button>
      <button agentId={withComputedKey.badId} agentDescription="Computed key unsupported">
        Skip computed
      </button>
      <button agentId={withArgs("helper")} agentDescription="Helper args unsupported">
        Skip helper args
      </button>
      <button agentId={dynamicId} agentDescription="Skipped dynamic control">
        Skip dynamic
      </button>
    </main>
  );
}
