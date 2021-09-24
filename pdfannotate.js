/**
 * PDFAnnotate v1.0.1
 * Author: Ravisha Heshan
 */

var PDFAnnotate = function (container_id, url, options = {}) {
	this.number_of_pages = 0;
	this.pages_rendered = 0;
	this.active_tool = 1; // 1 - Free hand, 2 - Text, 3 - Arrow, 4 - Rectangle
	this.fabricObjects = [];
	this.fabricObjectsData = [];
	this.color = '#212121';
	this.borderColor = '#000000';
	this.borderSize = 1;
	this.font_size = 16;
	this.active_canvas = 0;
	this.container_id = container_id;
	this.url = url;
	this.pageImageCompression = options.pageImageCompression
			? options.pageImageCompression.toUpperCase()
			: "NONE";
	this.textBoxText = 'Sample Text';
	this.format;
	this.orientation;

	var self = this;

	var loadingTask = pdfjsLib.getDocument(this.url);
	loadingTask.promise.then(function (pdf) {
		var scale = options.scale ? options.scale : 1.3;
	    self.number_of_pages = pdf.numPages;

	    for (var i = 1; i <= pdf.numPages; i++) {
	        pdf.getPage(i).then(function (page) {
				if (typeof self.format === 'undefined' ||
					typeof self.orientation === 'undefined'
				) {
					var originalViewport = page.getViewport({ scale: 1 });
					self.format = [originalViewport.width, originalViewport.height];
					self.orientation = originalViewport.width > originalViewport.height
						? "landscape"
						: "portrait";
				}

	            var viewport = page.getViewport({scale: scale});
	            var canvas = document.createElement('canvas');
	            document.getElementById(self.container_id).appendChild(canvas);
	            canvas.className = 'pdf-canvas';
	            canvas.height = viewport.height;
	            canvas.width = viewport.width;
	            context = canvas.getContext('2d');

	            var renderContext = {
	                canvasContext: context,
	                viewport: viewport
				};
	            var renderTask = page.render(renderContext);
	            renderTask.promise.then(function () {
	                $('.pdf-canvas').each(function (index, el) {
	                    $(el).attr('id', 'page-' + (index + 1) + '-canvas');
	                });
	                self.pages_rendered++;
	                if (self.pages_rendered == self.number_of_pages) {
						self.initFabric();
					}
	            });
	        });
	    }
	}, function (reason) {
	    console.error(reason);
	});

	this.initFabric = function () {
		var self = this;
		let canvases = Array.from(document.querySelectorAll(`#${self.container_id} canvas`));
	    canvases.forEach(function (el, index) {
	        var background = el.toDataURL('image/png');
	        var fabricObj = new fabric.Canvas(el.id, {
	            freeDrawingBrush: {
	                width: 1,
	                color: self.color
	            }
	        });
			self.fabricObjects.push(fabricObj);

			if (typeof options.onPageUpdated == 'function') {
				fabricObj.on('object:added', function () {
					var oldValue = Object.assign({}, self.fabricObjectsData[index]);
					self.fabricObjectsData[index] = fabricObj.toJSON();
					options.onPageUpdated(
						index + 1,
						oldValue,
						self.fabricObjectsData[index]
					);
				});
			}
	        fabricObj.setBackgroundImage(background, fabricObj.renderAll.bind(fabricObj));
	        $(fabricObj.upperCanvasEl).click(function (event) {
	            self.active_canvas = index;
	            self.fabricClickHandler(event, fabricObj);
			});
			fabricObj.on('after:render', function () {
				self.fabricObjectsData[index] = fabricObj.toJSON();
				fabricObj.off('after:render');
			});

			if (index === canvases.length - 1 && 
				typeof options.ready === 'function'
			) {
				options.ready();
			}
		});
	};

	this.fabricClickHandler = function (event, fabricObj) {
		var self = this;
	    if (self.active_tool == 2) {
	        var text = new fabric.IText(self.textBoxText, {
	            left: event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
	            top: event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
	            fill: self.color,
	            fontSize: self.font_size,
	            selectable: true
	        });
	        fabricObj.add(text);
	        self.active_tool = 0;
	    }
	};
};

PDFAnnotate.prototype.enableSelector = function () {
	var self = this;
	self.active_tool = 0;
	if (self.fabricObjects.length > 0) {
	    $.each(self.fabricObjects, function (index, fabricObj) {
	        fabricObj.isDrawingMode = false;
	    });
	}
};

PDFAnnotate.prototype.enablePencil = function () {
	var self = this;
	self.active_tool = 1;
	if (self.fabricObjects.length > 0) {
	    $.each(self.fabricObjects, function (index, fabricObj) {
	        fabricObj.isDrawingMode = true;
	    });
	}
};

PDFAnnotate.prototype.enableAddText = function (text) {
	var self = this;
	self.active_tool = 2;
	if (typeof text === 'string') {
		self.textBoxText = text;
	}
	if (self.fabricObjects.length > 0) {
	    $.each(self.fabricObjects, function (index, fabricObj) {
	        fabricObj.isDrawingMode = false;
	    });
	}
};

PDFAnnotate.prototype.enableRectangle = function () {
	var self = this;
	var fabricObj = self.fabricObjects[self.active_canvas];
	self.active_tool = 4;
	if (self.fabricObjects.length > 0) {
		$.each(self.fabricObjects, function (index, fabricObj) {
			fabricObj.isDrawingMode = false;
		});
	}

	var rect = new fabric.Rect({
		width: 100,
		height: 100,
		fill: self.color,
		stroke: self.borderColor,
		strokeSize: self.borderSize
	});
	fabricObj.add(rect);
};

PDFAnnotate.prototype.enableAddArrow = function () {
	var self = this;
	self.active_tool = 3;
	if (self.fabricObjects.length > 0) {
	    $.each(self.fabricObjects, function (index, fabricObj) {
	        fabricObj.isDrawingMode = false;
	        new Arrow(fabricObj, self.color, function () {
	            self.active_tool = 0;
	        });
	    });
	}
};

PDFAnnotate.prototype.addImageToCanvas = function () {
	var self = this;
	var fabricObj = self.fabricObjects[self.active_canvas];

	if (fabricObj) {
		var inputElement = document.createElement("input");
		inputElement.type = 'file';
		inputElement.accept = ".jpg,.jpeg,.png,.PNG,.JPG,.JPEG";
		inputElement.onchange = function() {
			var reader = new FileReader();
			reader.addEventListener("load", function () {
				inputElement.remove();
				var image = new Image();
				image.onload = function () {
					fabricObj.add(new fabric.Image(image));
				};
				image.src = this.result;
			}, false);
			reader.readAsDataURL(inputElement.files[0]);
		};
		document.getElementsByTagName('body')[0].appendChild(inputElement);
		inputElement.click();
	}
};

PDFAnnotate.prototype.deleteSelectedObject = function () {
	var self = this;
	var activeObject = self.fabricObjects[self.active_canvas].getActiveObject();
	if (activeObject) {
	    if (confirm('Are you sure ?')) {
			self.fabricObjects[self.active_canvas].remove(activeObject);
		}
	}
};

PDFAnnotate.prototype.savePdf = function (fileName) {
	var self = this;
	var format = self.format || 'a4';
	var orientation = self.orientation || "portrait";
	if (!self.fabricObjects.length) return;
	var doc = new jspdf.jsPDF({format, orientation});
	if (typeof fileName === 'undefined') {
		fileName = `${new Date().getTime()}.pdf`;
	}

	self.fabricObjects.forEach(function (fabricObj, index) {
		if (index != 0) {
			doc.addPage(format, orientation);
			doc.setPage(index + 1);
		}
		doc.addImage(
			fabricObj.toDataURL({
				format: 'png'
			}),
			self.pageImageCompression == "NONE" ? "PNG" : "JPEG",
			0,
			0,
			doc.internal.pageSize.getWidth(),
			doc.internal.pageSize.getHeight(),
			`page-${index + 1}`,
			["FAST", "MEDIUM", "SLOW"].indexOf(self.pageImageCompression) >= 0
				? self.pageImageCompression
				: undefined
		);
		if (index === self.fabricObjects.length - 1) {
			doc.save(fileName);
		}
	});
};

PDFAnnotate.prototype.setBrushSize = function (size) {
	var self = this;
	$.each(self.fabricObjects, function (index, fabricObj) {
	    fabricObj.freeDrawingBrush.width = size;
	});
};

PDFAnnotate.prototype.setColor = function (color) {
	var self = this;
	self.color = color;
	$.each(self.fabricObjects, function (index, fabricObj) {
        fabricObj.freeDrawingBrush.color = color;
    });
};

PDFAnnotate.prototype.setBorderColor = function (color) {
	this.borderColor = color;
};

PDFAnnotate.prototype.setFontSize = function (size) {
	this.font_size = size;
};

PDFAnnotate.prototype.setBorderSize = function (size) {
	this.borderSize = size;
};

PDFAnnotate.prototype.clearActivePage = function () {
	var self = this;
	var fabricObj = self.fabricObjects[self.active_canvas];
	var bg = fabricObj.backgroundImage;
	if (confirm('Are you sure?')) {
	    fabricObj.clear();
	    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
	}
};

PDFAnnotate.prototype.serializePdf = function (callback) {
	var self = this;
	var pageAnnotations = [];
	self.fabricObjects.forEach(function (fabricObject) {
		fabricObject.clone(function (fabricObjectCopy) {
			fabricObjectCopy.setBackgroundImage(null);
			fabricObjectCopy.setBackgroundColor('');
			pageAnnotations.push(fabricObjectCopy);
			if (pageAnnotations.length === self.fabricObjects.length) {
				var data = {
					page_setup: {
						format: self.format,
						orientation: self.orientation,
					},
					pages: pageAnnotations,
				};
				callback(JSON.stringify(data));
			}
		});
	});
};

PDFAnnotate.prototype.loadFromJSON = function (jsonData) {
	var self = this;
	var { page_setup, pages } = jsonData;
	if (typeof pages === 'undefined') {
		pages = jsonData;
	}
	if (typeof page_setup === 'object' &&
		typeof page_setup.format === 'string' &&
		typeof page_setup.orientation === 'string'
	) {
		self.format = page_setup.format;
		self.orientation = page_setup.orientation;
	}
	$.each(self.fabricObjects, function (index, fabricObj) {
		if (pages.length > index) {
			fabricObj.loadFromJSON(pages[index], function () {
				self.fabricObjectsData[index] = fabricObj.toJSON();
			});
		}
	});
};

PDFAnnotate.prototype.setDefaultTextForTextBox = function (text) {
	var self = this;
	if (typeof text === 'string') {
		self.textBoxText = text;
	}
};
