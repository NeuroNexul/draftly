import { MarklyPlugin } from "../plugin";
import { HeadingPlugin } from "./heading-plugin";
import { InlinePlugin } from "./inline-plugin";
import { ListPlugin } from "./list-plugin";

const defaultPlugins: MarklyPlugin[] = [new HeadingPlugin(), new InlinePlugin(), new ListPlugin()];

export { defaultPlugins };
