FROM kyso-jupyter

USER root

RUN pip install fileupload ipywidgets jupyter_dashboards
RUN jupyter nbextension install --py fileupload
RUN jupyter nbextension enable --py fileupload
RUN jupyter nbextension enable --py --sys-prefix widgetsnbextension
RUN jupyter dashboards quick-setup --sys-prefix

USER ds
