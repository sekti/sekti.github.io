import imageio
map = imageio.imread('original-map.png')

translationTable = [
	([0,176,240]," "),
	([146,208,80],"·"),
	([191,143,0], "1"),
	([131,60,12], "2"),
	([166,166,166], "R"),
	([255,0,0], "P"),
	([255,255,255], "B"),
	([89,89,89], "B"),
	([255,255,0], "S"),
	([223,224,184], "B"),
]
dimY = map.shape[0]
dimX = map.shape[1]

print("originalMap = [")
for y in range(dimY):
	print('"', end='')
	for x in range(dimX):
		p = map[y,x]
		done = False
		for (col,symbol) in translationTable:
			if (col[0] == p[0] and col[1] == p[1] and col[2] == p[2]):
				done = True
				print(symbol, end='')

		if (not done):
			print("Unknown color", p)
			exit()
	print('",')
print("]")