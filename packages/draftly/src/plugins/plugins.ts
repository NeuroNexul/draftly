import { DraftlyPlugin } from "../plugin";
import { HeadingPlugin } from "./heading-plugin";
import { InlinePlugin } from "./inline-plugin";
import { ListPlugin } from "./list-plugin";
import { HTMLPlugin } from "./html-plugin";

const defaultPlugins: DraftlyPlugin[] = [new HeadingPlugin(), new InlinePlugin(), new ListPlugin(), new HTMLPlugin()];

export { defaultPlugins };
