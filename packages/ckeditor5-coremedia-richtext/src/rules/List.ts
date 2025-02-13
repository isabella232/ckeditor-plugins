import { allFilterRules, ElementFilterRule } from "@coremedia/ckeditor5-dataprocessor-support/ElementProxy";
import { ElementsFilterRuleSetConfiguration } from "@coremedia/ckeditor5-dataprocessor-support/Rules";
import { langDataFilterRule, langMapperConfiguration, langViewFilterRule } from "./Lang";

// Workaround/Fix for CMS-10539 (Error while Saving when deleting in Lists, MSIE11)
const removeInvalidList: ElementFilterRule = (params) => {
  params.node.remove = params.node.empty || !params.node.findFirst("li");
};

const listRules: ElementsFilterRuleSetConfiguration = {
  ol: {
    toData: allFilterRules(langDataFilterRule, removeInvalidList),
    toView: langViewFilterRule,
  },
  ul: {
    toData: allFilterRules(langDataFilterRule, removeInvalidList),
    toView: langViewFilterRule,
  },
  li: langMapperConfiguration,
};

export { listRules };
